import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { MailService } from "../mail/mail.service";
import {
  CreateCsmActivityDto, CreateCsmCaseDto, CreateCsmContactDto, CreateCsmContractDto, CreateCsmCustomerDto,
  CreateCsmEscalationDto, CreateCsmMajorCaseDto, CreateCsmSlaDto, CreateCsmViewDto, RenewCsmContractDto,
  UpdateCsmCaseDto, UpdateCsmContactDto, UpdateCsmContractDto, UpdateCsmCustomerDto, UpdateCsmSlaDto,
} from "./dto/csm.dto";

type Row = Record<string, any>;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

const CASE_SELECT = `
  SELECT c.case_id AS "caseId", c.case_code AS "caseCode", c.customer_id AS "customerId",
    cu.customer_code AS "customerCode", cu.name AS "customerName", cu.customer_type AS "customerType",
    c.customer_contact AS "customerContact", c.contact_email AS "contactEmail", c.contact_phone AS "contactPhone",
    c.case_type AS "caseType", c.category, c.subcategory, c.product_service AS "productService",
    c.short_description AS "shortDescription", c.description, c.priority, c.impact, c.urgency, c.status, c.source,
    c.assignment_group_id AS "assignmentGroupId", g.group_name AS "assignmentGroup",
    c.assigned_to AS "assignedToId", u.full_name AS "assignedTo",
    c.sla_id AS "slaId", s.sla_name AS "slaName", c.sla_response_target AS "slaResponseTarget",
    c.sla_resolution_target AS "slaResolutionTarget", c.sla_response_met AS "slaResponseMet",
    c.issue_details AS "issueDetails", c.resolution_code AS "resolutionCode",
    c.resolution_summary AS "resolutionSummary", c.closure_notes AS "closureNotes",
    c.created_at AS "createdAt", c.updated_at AS "updatedAt", c.resolved_at AS "resolvedAt", c.closed_at AS "closedAt"
  FROM csm_cases c
  JOIN csm_customers cu ON cu.customer_id = c.customer_id
  LEFT JOIN assignment_groups g ON g.group_id = c.assignment_group_id
  LEFT JOIN users u ON u.user_id = c.assigned_to
  LEFT JOIN csm_slas s ON s.sla_id = c.sla_id
`;

@Injectable()
export class CsmService {
  private readonly logger = new Logger(CsmService.name);

  constructor(
    private readonly db: DataSource,
    @Inject(MailService) private readonly mail: Pick<MailService, "queue">,
  ) {}

  private async code(table: string, idColumn: string, id: number, prefix: string, width = 6): Promise<void> {
    await this.db.query(
      `UPDATE ${table} SET ${idColumn} = $1 || lpad($2::text, $3, '0') WHERE ${idColumn.replace(/_code$/, "_id")} = $2`,
      [prefix, id, width],
    );
  }

  async dashboard(userId: number) {
    const [stats]: Row[] = await this.db.query(`
      SELECT COUNT(*)::int AS "totalCases",
        COUNT(*) FILTER (WHERE status NOT IN ('Resolved', 'Closed'))::int AS "openCases",
        COUNT(*) FILTER (WHERE priority IN ('High', 'Critical') AND status NOT IN ('Resolved', 'Closed'))::int AS "priorityCases",
        COUNT(*) FILTER (WHERE sla_resolution_target < now() AND status NOT IN ('Resolved', 'Closed'))::int AS "slaBreaches",
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS "createdThisMonth"
      FROM csm_cases
    `);
    const [customerStats]: Row[] = await this.db.query(`SELECT COUNT(*)::int AS "customers" FROM csm_customers WHERE status = 'Active'`);
    const [slaStats]: Row[] = await this.db.query(`
      SELECT COUNT(*)::int AS "withinSla"
      FROM csm_cases WHERE status NOT IN ('Resolved', 'Closed')
        AND (sla_resolution_target IS NULL OR sla_resolution_target >= now())
    `);
    const recent = await this.db.query(
      `${CASE_SELECT} WHERE c.status NOT IN ('Resolved', 'Closed') AND (c.assigned_to = $1 OR c.assignment_group_id IN (SELECT group_id FROM assignment_group_members WHERE user_id = $1)) ORDER BY c.updated_at DESC LIMIT 8`,
      [userId],
    );
    return { ...stats, ...customerStats, ...slaStats, recentCases: recent };
  }

  async listCases(filters: { q?: string; status?: string; priority?: string; customerType?: string; viewId?: number; userId?: number }) {
    const values: unknown[] = [];
    const where: string[] = [];
    const add = (column: string, value: unknown) => { values.push(value); where.push(`${column} = $${values.length}`); };
    if (filters.q?.trim()) {
      values.push(`%${filters.q.trim()}%`);
      where.push(`(c.case_code ILIKE $${values.length} OR c.short_description ILIKE $${values.length} OR cu.name ILIKE $${values.length})`);
    }
    if (filters.status) add("c.status", filters.status);
    if (filters.priority) add("c.priority", filters.priority);
    if (filters.customerType) add("cu.customer_type", filters.customerType);
    if (filters.viewId) {
      const [view]: Row[] = await this.db.query(
        `SELECT filters FROM csm_case_views WHERE view_id = $1 AND (is_shared = true OR created_by = $2)`,
        [filters.viewId, filters.userId],
      );
      if (!view) throw new NotFoundException("Case view not found.");
      const filter = view.filters as Row;
      if (filter.status) add("c.status", filter.status);
      if (filter.priority) add("c.priority", filter.priority);
      if (filter.customerType) add("cu.customer_type", filter.customerType);
    }
    const query = `${CASE_SELECT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY c.updated_at DESC LIMIT 500`;
    return this.db.query(query, values);
  }

  async getCase(id: number) {
    const [item]: Row[] = await this.db.query(`${CASE_SELECT} WHERE c.case_id = $1`, [id]);
    if (!item) throw new NotFoundException("Case not found.");
    item.activity = await this.caseActivity(id);
    item.relatedMajorCases = await this.db.query(
      `SELECT major_case_id AS "majorCaseId", major_case_code AS "majorCaseCode", title, status
       FROM csm_major_cases WHERE related_case_ids @> $1::jsonb ORDER BY created_at DESC`,
      [JSON.stringify([id])],
    );
    return item;
  }

  async createCase(userId: number, dto: CreateCsmCaseDto) {
    const customer = await this.db.query(`SELECT customer_id FROM csm_customers WHERE customer_id = $1 AND status = 'Active'`, [dto.customerId]);
    if (!customer.length) throw new BadRequestException("Select an active customer.");
    if (dto.assignedTo && !dto.assignmentGroupId) {
      throw new BadRequestException("Select a support group before assigning an agent.");
    }
    const sla: Row[] = dto.slaId ? await this.db.query(
      `SELECT response_minutes, resolution_minutes FROM csm_slas WHERE sla_id = $1 AND status = 'Active'`, [dto.slaId],
    ) : [];
    if (dto.slaId && !sla.length) throw new BadRequestException("Select an active SLA.");
    if (dto.assignedTo && dto.assignmentGroupId) {
      const member: Row[] = await this.db.query(
        `SELECT 1 FROM assignment_group_members WHERE group_id = $1 AND user_id = $2`,
        [dto.assignmentGroupId, dto.assignedTo],
      );
      if (!member.length) throw new BadRequestException("The selected assignee is not a member of the selected group.");
    }
    if (dto.assignedTo) {
      const [user]: Row[] = await this.db.query(`SELECT is_active FROM users WHERE user_id = $1`, [dto.assignedTo]);
      if (!user?.is_active) throw new BadRequestException("Select an active assignee.");
    }
    const responseMinutes = sla[0]?.response_minutes;
    const resolutionMinutes = sla[0]?.resolution_minutes;
    const responseTarget = responseMinutes ? new Date(Date.now() + Number(responseMinutes) * 60000) : null;
    const resolutionTarget = resolutionMinutes ? new Date(Date.now() + Number(resolutionMinutes) * 60000) : null;
    const [created]: Row[] = await this.db.query(`
      INSERT INTO csm_cases (
        customer_id, customer_contact, contact_email, contact_phone, case_type, category, subcategory, product_service,
        short_description, description, priority, impact, urgency, status, source, assignment_group_id, assigned_to,
        sla_id, sla_response_target, sla_resolution_target, issue_details, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22)
      RETURNING case_id AS "caseId"
    `, [
      dto.customerId, dto.customerContact?.trim() || null, dto.contactEmail?.trim() || null, dto.contactPhone?.trim() || null,
      dto.caseType, dto.category.trim(), dto.subcategory?.trim() || null, dto.productService?.trim() || null,
      dto.shortDescription.trim(), dto.description.trim(), dto.priority ?? "Medium", dto.impact ?? "Single User",
      dto.urgency ?? "Medium", dto.assignmentGroupId ? "Assigned" : "New", dto.source ?? "Agent",
      dto.assignmentGroupId ?? null, dto.assignedTo ?? null, dto.slaId ?? null, responseTarget, resolutionTarget,
      JSON.stringify(dto.issueDetails ?? {}), userId,
    ]);
    await this.code("csm_cases", "case_code", created.caseId, "CSE");
    await this.db.query(
      `INSERT INTO csm_case_activities (case_id, activity_type, content, created_by) VALUES ($1, 'Status Change', 'Case created.', $2)`,
      [created.caseId, userId],
    );
    return this.getCase(created.caseId);
  }

  async updateCase(id: number, userId: number, dto: UpdateCsmCaseDto) {
    const mappings: Record<string, string> = {
      caseType: "case_type", category: "category", subcategory: "subcategory", productService: "product_service",
      shortDescription: "short_description", description: "description", priority: "priority", impact: "impact",
      urgency: "urgency", status: "status", assignmentGroupId: "assignment_group_id", assignedTo: "assigned_to",
      slaId: "sla_id", issueDetails: "issue_details", resolutionCode: "resolution_code",
      resolutionSummary: "resolution_summary", closureNotes: "closure_notes",
    };
    const entries = Object.entries(dto).filter(([key, value]) => mappings[key] && value !== undefined);
    if (!entries.length) return this.getCase(id);
    const old = await this.getCase(id);
    const effectiveGroupId = dto.assignmentGroupId === undefined ? old.assignmentGroupId : dto.assignmentGroupId;
    const effectiveAssigneeId = dto.assignedTo === undefined ? old.assignedToId : dto.assignedTo;
    if (effectiveAssigneeId && effectiveGroupId) {
      const member: Row[] = await this.db.query(
        `SELECT 1 FROM assignment_group_members WHERE group_id = $1 AND user_id = $2`,
        [effectiveGroupId, effectiveAssigneeId],
      );
      if (!member.length) throw new BadRequestException("The selected assignee is not a member of the selected group.");
    }
    if (dto.assignedTo && !effectiveGroupId) throw new BadRequestException("Select a support group before assigning an agent.");
    if (dto.status === "Resolved" && !dto.resolutionSummary?.trim() && !old.resolutionSummary) {
      throw new BadRequestException("Enter a resolution summary before resolving the case.");
    }
    if (dto.status === "Closed" && old.status !== "Resolved") {
      throw new BadRequestException("Resolve the case before closing it.");
    }
    if (dto.status === "Closed" && !dto.closureNotes?.trim() && !old.closureNotes) {
      throw new BadRequestException("Enter closure notes before closing the case.");
    }
    const values: unknown[] = [];
    const sets = entries.map(([key, value]) => {
      values.push(key === "issueDetails" ? JSON.stringify(value) : value);
      return `"${mappings[key]}" = $${values.length}${key === "issueDetails" ? "::jsonb" : ""}`;
    });
    if (dto.status === "Resolved") sets.push(`"resolved_at" = now()`);
    if (dto.status === "Closed") sets.push(`"closed_at" = now()`);
    if (dto.status && dto.status !== "Resolved" && dto.status !== "Closed") {
      sets.push(`"resolved_at" = NULL`, `"closed_at" = NULL`);
    }
    values.push(id);
    const updated: Row[] = await this.db.query(
      `UPDATE csm_cases SET ${sets.join(", ")}, updated_at = now() WHERE case_id = $${values.length} RETURNING case_id`,
      values,
    );
    if (!updated.length) throw new NotFoundException("Case not found.");
    if (dto.status && dto.status !== old.status) {
      await this.db.query(
        `INSERT INTO csm_case_activities (case_id, activity_type, content, created_by) VALUES ($1, 'Status Change', $2, $3)`,
        [id, `Status changed from ${old.status} to ${dto.status}.`, userId],
      );
    }
    return this.getCase(id);
  }

  async caseActivity(id: number) {
    const found = await this.db.query(`SELECT 1 FROM csm_cases WHERE case_id = $1`, [id]);
    if (!found.length) throw new NotFoundException("Case not found.");
    return this.db.query(`
      SELECT a.activity_id AS "activityId", a.activity_type AS "activityType", a.content,
        a.created_at AS "createdAt", u.full_name AS "createdBy"
      FROM csm_case_activities a LEFT JOIN users u ON u.user_id = a.created_by
      WHERE a.case_id = $1 ORDER BY a.created_at DESC
    `, [id]);
  }

  async addCaseActivity(id: number, userId: number, dto: CreateCsmActivityDto) {
    await this.getCase(id);
    const [row]: Row[] = await this.db.query(`
      INSERT INTO csm_case_activities (case_id, activity_type, content, created_by)
      VALUES ($1, $2, $3, $4) RETURNING activity_id AS "activityId"
    `, [id, dto.activityType, dto.content.trim(), userId]);
    if (dto.activityType === "Customer Update") {
      await this.notifyCaseCustomer(id, "Customer service case update", dto.content.trim());
    }
    return row;
  }

  private async notifyCaseCustomer(caseId: number, subject: string, message: string) {
    const [context]: Row[] = await this.db.query(`
      SELECT c.case_code AS "caseCode", c.short_description AS "shortDescription",
        COALESCE(c.contact_email, primary_contact.email, cu.email) AS email
      FROM csm_cases c JOIN csm_customers cu ON cu.customer_id = c.customer_id
      LEFT JOIN csm_customer_contacts primary_contact
        ON primary_contact.customer_id = cu.customer_id AND primary_contact.is_primary = true AND primary_contact.status = 'Active'
      WHERE c.case_id = $1
    `, [caseId]);
    if (!context?.email) return;
    try {
      await this.mail.queue({
        to: context.email,
        subject: `${subject}: ${context.caseCode} - ${context.shortDescription}`,
        html: `<p>Update for case <strong>${escapeHtml(context.caseCode)}</strong>.</p><p>${escapeHtml(message)}</p>`,
      });
    } catch (error) {
      this.logger.error(`Could not queue customer case update for ${context.caseCode}: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException("The update was saved, but its customer email could not be queued. Contact an administrator before retrying.");
    }
  }

  async listCaseAttachments(caseId: number) {
    const exists: Row[] = await this.db.query(`SELECT 1 FROM csm_cases WHERE case_id = $1`, [caseId]);
    if (!exists.length) throw new NotFoundException("Case not found.");
    return this.db.query(`
      SELECT attachment_id AS "attachmentId", case_id AS "caseId", file_name AS "fileName",
        mime_type AS "mimeType", size_bytes AS "sizeBytes", uploaded_by AS "uploadedBy", uploaded_at AS "uploadedAt"
      FROM csm_case_attachments WHERE case_id = $1 ORDER BY uploaded_at DESC
    `, [caseId]);
  }

  async addCaseAttachment(caseId: number, userId: number, file: Express.Multer.File) {
    const exists: Row[] = await this.db.query(`SELECT 1 FROM csm_cases WHERE case_id = $1`, [caseId]);
    if (!exists.length) throw new NotFoundException("Case not found.");
    const [row]: Row[] = await this.db.query(`
      INSERT INTO csm_case_attachments (case_id, file_name, storage_name, mime_type, size_bytes, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING attachment_id AS "attachmentId"
    `, [caseId, file.originalname, file.filename, file.mimetype, file.size, userId]);
    return (await this.listCaseAttachments(caseId)).find((item: Row) => item.attachmentId === row.attachmentId);
  }

  async getCaseAttachment(caseId: number, attachmentId: number) {
    const [row]: Row[] = await this.db.query(`
      SELECT attachment_id AS "attachmentId", case_id AS "caseId", file_name AS "fileName",
        storage_name AS "storageName", mime_type AS "mimeType", size_bytes AS "sizeBytes",
        uploaded_by AS "uploadedBy", uploaded_at AS "uploadedAt"
      FROM csm_case_attachments WHERE case_id = $1 AND attachment_id = $2
    `, [caseId, attachmentId]);
    if (!row) throw new NotFoundException("Case attachment not found.");
    return row;
  }

  async removeCaseAttachment(caseId: number, attachmentId: number) {
    const row = await this.getCaseAttachment(caseId, attachmentId);
    await this.db.query(`DELETE FROM csm_case_attachments WHERE case_id = $1 AND attachment_id = $2`, [caseId, attachmentId]);
    return row;
  }

  async listCustomers(q?: string, type?: string) {
    const values: unknown[] = [];
    const where: string[] = [];
    if (type) { values.push(type); where.push(`c.customer_type = $${values.length}`); }
    if (q?.trim()) {
      values.push(`%${q.trim()}%`);
      where.push(`(c.name ILIKE $${values.length} OR c.customer_code ILIKE $${values.length} OR c.email ILIKE $${values.length})`);
    }
    return this.db.query(`
      SELECT c.customer_id AS "customerId", c.customer_code AS "customerCode", c.customer_type AS "customerType",
        c.name, c.email, c.phone, c.industry, c.account_type AS "accountType", c.region, c.website,
        c.parent_customer_id AS "parentCustomerId", p.name AS "parentCustomer", c.location, c.segment,
        c.preferred_channel AS "preferredChannel", c.status, c.created_at AS "createdAt"
      FROM csm_customers c LEFT JOIN csm_customers p ON p.customer_id = c.parent_customer_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY c.name LIMIT 500
    `, values);
  }

  async createCustomer(userId: number, dto: CreateCsmCustomerDto) {
    if (dto.customerType === "B2C" && dto.parentCustomerId) throw new BadRequestException("A consumer cannot have a parent business account.");
    if (dto.parentCustomerId) {
      const parent: Row[] = await this.db.query(`SELECT customer_type FROM csm_customers WHERE customer_id = $1 AND status = 'Active'`, [dto.parentCustomerId]);
      if (!parent.length || parent[0].customer_type !== "B2B") throw new BadRequestException("Parent account must be an active business customer.");
    }
    const [row]: Row[] = await this.db.query(`
      INSERT INTO csm_customers (customer_type, name, email, phone, industry, account_type, region, website,
        parent_customer_id, location, segment, preferred_channel, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING customer_id AS "customerId"
    `, [
      dto.customerType, dto.name.trim(), dto.email?.trim() || null, dto.phone?.trim() || null,
      dto.industry?.trim() || null, dto.accountType?.trim() || null, dto.region?.trim() || null,
      dto.website?.trim() || null, dto.parentCustomerId ?? null, dto.location?.trim() || null,
      dto.segment?.trim() || null, dto.preferredChannel?.trim() || null, userId,
    ]);
    await this.code("csm_customers", "customer_code", row.customerId, dto.customerType === "B2B" ? "ACC" : "CUS", 7);
    return (await this.listCustomers()).find((item: Row) => item.customerId === row.customerId);
  }

  async getCustomerProfile(id: number) {
    const [customer]: Row[] = await this.db.query(`
      SELECT c.customer_id AS "customerId", c.customer_code AS "customerCode", c.customer_type AS "customerType",
        c.name, c.email, c.phone, c.industry, c.account_type AS "accountType", c.region, c.website,
        c.parent_customer_id AS "parentCustomerId", p.name AS "parentCustomer", c.location, c.segment,
        c.preferred_channel AS "preferredChannel", c.status, c.created_at AS "createdAt", c.updated_at AS "updatedAt"
      FROM csm_customers c LEFT JOIN csm_customers p ON p.customer_id = c.parent_customer_id
      WHERE c.customer_id = $1
    `, [id]);
    if (!customer) throw new NotFoundException("Customer not found.");
    const [contacts, contracts, cases] = await Promise.all([
      this.listCustomerContacts(id),
      this.db.query(`SELECT contract_id AS "contractId", contract_code AS "contractCode", contract_name AS "contractName",
        contract_type AS "contractType", status, start_date AS "startDate", end_date AS "endDate", auto_renew AS "autoRenew"
        FROM csm_contracts WHERE customer_id = $1 ORDER BY end_date DESC`, [id]),
      this.db.query(`SELECT case_id AS "caseId", case_code AS "caseCode", short_description AS "shortDescription",
        case_type AS "caseType", priority, status, created_at AS "createdAt"
        FROM csm_cases WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]),
    ]);
    return { ...customer, contacts, contracts, cases };
  }

  async updateCustomer(id: number, dto: UpdateCsmCustomerDto) {
    const mappings: Record<string, string> = {
      name: "name", email: "email", phone: "phone", industry: "industry", accountType: "account_type",
      region: "region", website: "website", location: "location", segment: "segment",
      preferredChannel: "preferred_channel", status: "status",
    };
    const entries = Object.entries(dto).filter(([key, value]) => mappings[key] && value !== undefined);
    if (!entries.length) return this.getCustomerProfile(id);
    const values: unknown[] = [];
    const sets = entries.map(([key, value]) => {
      values.push(typeof value === "string" ? value.trim() || null : value);
      return `"${mappings[key]}" = $${values.length}`;
    });
    values.push(id);
    const rows: Row[] = await this.db.query(
      `UPDATE csm_customers SET ${sets.join(", ")}, updated_at = now() WHERE customer_id = $${values.length} RETURNING customer_id`,
      values,
    );
    if (!rows.length) throw new NotFoundException("Customer not found.");
    return this.getCustomerProfile(id);
  }

  async listCustomerContacts(customerId: number) {
    const exists: Row[] = await this.db.query(`SELECT 1 FROM csm_customers WHERE customer_id = $1`, [customerId]);
    if (!exists.length) throw new NotFoundException("Customer not found.");
    return this.db.query(`
      SELECT contact_id AS "contactId", customer_id AS "customerId", full_name AS "fullName", email, phone,
        title, is_primary AS "isPrimary", status, created_at AS "createdAt"
      FROM csm_customer_contacts WHERE customer_id = $1 ORDER BY is_primary DESC, full_name
    `, [customerId]);
  }

  async createCustomerContact(customerId: number, dto: CreateCsmContactDto) {
    const customer: Row[] = await this.db.query(`SELECT 1 FROM csm_customers WHERE customer_id = $1`, [customerId]);
    if (!customer.length) throw new NotFoundException("Customer not found.");
    if (dto.isPrimary) await this.db.query(`UPDATE csm_customer_contacts SET is_primary = false WHERE customer_id = $1`, [customerId]);
    const [row]: Row[] = await this.db.query(`
      INSERT INTO csm_customer_contacts (customer_id, full_name, email, phone, title, is_primary)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING contact_id AS "contactId"
    `, [customerId, dto.fullName.trim(), dto.email?.trim() || null, dto.phone?.trim() || null, dto.title?.trim() || null, dto.isPrimary ?? false]);
    return (await this.listCustomerContacts(customerId)).find((item: Row) => item.contactId === row.contactId);
  }

  async updateCustomerContact(customerId: number, contactId: number, dto: UpdateCsmContactDto) {
    const old: Row[] = await this.db.query(
      `SELECT contact_id FROM csm_customer_contacts WHERE customer_id = $1 AND contact_id = $2`,
      [customerId, contactId],
    );
    if (!old.length) throw new NotFoundException("Customer contact not found.");
    if (dto.isPrimary) await this.db.query(
      `UPDATE csm_customer_contacts SET is_primary = false WHERE customer_id = $1 AND contact_id <> $2`,
      [customerId, contactId],
    );
    const mappings: Record<string, string> = {
      fullName: "full_name", email: "email", phone: "phone", title: "title", isPrimary: "is_primary", status: "status",
    };
    const entries = Object.entries(dto).filter(([key, value]) => mappings[key] && value !== undefined);
    if (!entries.length) return (await this.listCustomerContacts(customerId)).find((item: Row) => item.contactId === contactId);
    const values: unknown[] = [];
    const sets = entries.map(([key, value]) => {
      values.push(typeof value === "string" ? value.trim() || null : value);
      return `"${mappings[key]}" = $${values.length}`;
    });
    values.push(contactId, customerId);
    await this.db.query(
      `UPDATE csm_customer_contacts SET ${sets.join(", ")}, updated_at = now()
       WHERE contact_id = $${values.length - 1} AND customer_id = $${values.length}`,
      values,
    );
    return (await this.listCustomerContacts(customerId)).find((item: Row) => item.contactId === contactId);
  }

  async customerHealth(q?: string) {
    const values: unknown[] = [];
    const where = q?.trim() ? `WHERE cu.name ILIKE $1 OR cu.customer_code ILIKE $1` : "";
    if (q?.trim()) values.push(`%${q.trim()}%`);
    return this.db.query(`
      SELECT cu.customer_id AS "customerId", cu.customer_code AS "customerCode", cu.customer_type AS "customerType",
        cu.name, cu.email, cu.location, cu.segment, cu.preferred_channel AS "preferredChannel",
        COUNT(DISTINCT c.case_id)::int AS "caseCount",
        COUNT(DISTINCT c.case_id) FILTER (WHERE c.status NOT IN ('Resolved', 'Closed'))::int AS "openCases",
        COUNT(DISTINCT c.case_id) FILTER (WHERE c.sla_resolution_target < now() AND c.status NOT IN ('Resolved', 'Closed'))::int AS "slaBreaches",
        COUNT(DISTINCT ct.contract_id)::int AS "activeContracts",
        GREATEST(0, 100 - COUNT(DISTINCT c.case_id) FILTER (WHERE c.status NOT IN ('Resolved', 'Closed')) * 2
          - COUNT(DISTINCT c.case_id) FILTER (WHERE c.sla_resolution_target < now() AND c.status NOT IN ('Resolved', 'Closed')) * 15)::int AS "healthScore"
      FROM csm_customers cu
      LEFT JOIN csm_cases c ON c.customer_id = cu.customer_id AND c.created_at >= now() - interval '90 days'
      LEFT JOIN csm_contracts ct ON ct.customer_id = cu.customer_id AND ct.status = 'Active'
      ${where}
      GROUP BY cu.customer_id ORDER BY "healthScore" DESC, cu.name LIMIT 500
    `, values);
  }

  async listContracts() {
    return this.db.query(`
      SELECT ct.contract_id AS "contractId", ct.contract_code AS "contractCode", ct.customer_id AS "customerId",
        cu.name AS "customerName", cu.customer_type AS "customerType", ct.contract_name AS "contractName",
        ct.contract_type AS "contractType", ct.owner_name AS "ownerName", ct.status, ct.start_date AS "startDate",
        ct.end_date AS "endDate", ct.auto_renew AS "autoRenew", ct.description, ct.services, ct.commercial_terms AS "commercialTerms",
        COUNT(s.sla_id)::int AS "slaCount"
      FROM csm_contracts ct JOIN csm_customers cu ON cu.customer_id = ct.customer_id
      LEFT JOIN csm_slas s ON s.contract_id = ct.contract_id
      GROUP BY ct.contract_id, cu.name, cu.customer_type ORDER BY ct.end_date DESC
    `);
  }

  async createContract(userId: number, dto: CreateCsmContractDto) {
    if (dto.endDate < dto.startDate) throw new BadRequestException("Contract end date must be on or after the start date.");
    const customer: Row[] = await this.db.query(
      `SELECT customer_type FROM csm_customers WHERE customer_id = $1 AND status = 'Active'`,
      [dto.customerId],
    );
    if (!customer.length || customer[0].customer_type !== "B2B") {
      throw new BadRequestException("Select an active business customer for a contract.");
    }
    const [row]: Row[] = await this.db.query(`
      INSERT INTO csm_contracts (customer_id, contract_name, contract_type, owner_name, status, start_date, end_date,
        auto_renew, description, services, commercial_terms, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12) RETURNING contract_id AS "contractId"
    `, [
      dto.customerId, dto.contractName.trim(), dto.contractType ?? "Service Contract", dto.ownerName?.trim() || null,
      dto.status ?? "Draft", dto.startDate, dto.endDate, dto.autoRenew ?? false, dto.description?.trim() || null,
      JSON.stringify(dto.services ?? []), JSON.stringify(dto.commercialTerms ?? {}), userId,
    ]);
    await this.code("csm_contracts", "contract_code", row.contractId, "CTR-", 6);
    return (await this.listContracts()).find((item: Row) => item.contractId === row.contractId);
  }

  async updateContract(id: number, dto: UpdateCsmContractDto) {
    const [old]: Row[] = await this.db.query(
      `SELECT start_date AS "startDate", end_date AS "endDate" FROM csm_contracts WHERE contract_id = $1`,
      [id],
    );
    if (!old) throw new NotFoundException("Contract not found.");
    const startDate = dto.startDate ?? old.startDate;
    const endDate = dto.endDate ?? old.endDate;
    if (endDate < startDate) throw new BadRequestException("Contract end date must be on or after the start date.");
    const mappings: Record<string, string> = {
      contractName: "contract_name", contractType: "contract_type", ownerName: "owner_name",
      status: "status", startDate: "start_date", endDate: "end_date", autoRenew: "auto_renew",
      description: "description", services: "services", commercialTerms: "commercial_terms",
    };
    const entries = Object.entries(dto).filter(([key, value]) => mappings[key] && value !== undefined);
    if (entries.length) {
      const values: unknown[] = [];
      const sets = entries.map(([key, value]) => {
        const json = key === "services" || key === "commercialTerms";
        values.push(json ? JSON.stringify(value) : typeof value === "string" ? value.trim() || null : value);
        return `"${mappings[key]}" = $${values.length}${json ? "::jsonb" : ""}`;
      });
      values.push(id);
      const rows: Row[] = await this.db.query(
        `UPDATE csm_contracts SET ${sets.join(", ")}, updated_at = now() WHERE contract_id = $${values.length} RETURNING contract_id`,
        values,
      );
      if (!rows.length) throw new NotFoundException("Contract not found.");
    }
    return (await this.listContracts()).find((item: Row) => item.contractId === id);
  }

  async renewContract(id: number, userId: number, dto: RenewCsmContractDto) {
    if (dto.endDate < dto.startDate) throw new BadRequestException("Renewal end date must be on or after its start date.");
    const runner = this.db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let newId: number | undefined;
    try {
      const [old]: Row[] = await runner.query(
        `SELECT * FROM csm_contracts WHERE contract_id = $1 FOR UPDATE`,
        [id],
      );
      if (!old) throw new NotFoundException("Contract not found.");
      if (old.status === "Terminated") throw new BadRequestException("A terminated contract cannot be renewed.");
      if (dto.startDate < String(old.end_date).slice(0, 10)) {
        throw new BadRequestException("Renewal cannot start before the existing contract ends.");
      }
      const [created]: Row[] = await runner.query(`
        INSERT INTO csm_contracts (customer_id, contract_name, contract_type, owner_name, status, start_date, end_date,
          auto_renew, description, services, commercial_terms, created_by)
        VALUES ($1,$2,$3,$4,'Active',$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)
        RETURNING contract_id AS "contractId"
      `, [
        old.customer_id, old.contract_name, old.contract_type, old.owner_name, dto.startDate, dto.endDate,
        old.auto_renew, old.description, JSON.stringify(old.services ?? []), JSON.stringify(old.commercial_terms ?? {}), userId,
      ]);
      newId = created.contractId;
      await runner.query(
        `UPDATE csm_contracts SET status = 'Expired', updated_at = now() WHERE contract_id = $1`,
        [id],
      );
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    if (!newId) throw new Error("Contract renewal completed without creating a contract record.");
    await this.code("csm_contracts", "contract_code", newId, "CTR-", 6);
    return (await this.listContracts()).find((item: Row) => item.contractId === newId);
  }

  async listSlas() {
    return this.db.query(`
      SELECT s.sla_id AS "slaId", s.sla_code AS "slaCode", s.sla_name AS "slaName", s.sla_type AS "slaType",
        s.service, s.contract_id AS "contractId", ct.contract_name AS "contractName", s.applies_to AS "appliesTo",
        s.priorities, s.response_minutes AS "responseMinutes", s.resolution_minutes AS "resolutionMinutes",
        s.availability_percent AS "availabilityPercent", s.escalation_policy AS "escalationPolicy", s.status, s.description
      FROM csm_slas s LEFT JOIN csm_contracts ct ON ct.contract_id = s.contract_id ORDER BY s.sla_name
    `);
  }

  async createSla(userId: number, dto: CreateCsmSlaDto) {
    if (dto.contractId) {
      const contract: Row[] = await this.db.query(`SELECT 1 FROM csm_contracts WHERE contract_id = $1`, [dto.contractId]);
      if (!contract.length) throw new BadRequestException("Select an existing contract.");
    }
    const [row]: Row[] = await this.db.query(`
      INSERT INTO csm_slas (sla_name, sla_type, service, contract_id, applies_to, priorities,
        response_minutes, resolution_minutes, availability_percent, escalation_policy, status, description, created_by)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10::jsonb,$11,$12,$13)
      RETURNING sla_id AS "slaId"
    `, [
      dto.slaName.trim(), dto.slaType ?? "Operational SLA", dto.service.trim(), dto.contractId ?? null,
      JSON.stringify(dto.appliesTo ?? ["Cases"]), JSON.stringify(dto.priorities ?? ["High", "Medium", "Low"]),
      dto.responseMinutes, dto.resolutionMinutes, dto.availabilityPercent ?? null,
      JSON.stringify(dto.escalationPolicy ?? {}), dto.status ?? "Draft", dto.description?.trim() || null, userId,
    ]);
    await this.code("csm_slas", "sla_code", row.slaId, "SLA-", 6);
    return (await this.listSlas()).find((item: Row) => item.slaId === row.slaId);
  }

  async updateSla(id: number, dto: UpdateCsmSlaDto) {
    const exists: Row[] = await this.db.query(`SELECT 1 FROM csm_slas WHERE sla_id = $1`, [id]);
    if (!exists.length) throw new NotFoundException("SLA not found.");
    if (dto.contractId) {
      const contract: Row[] = await this.db.query(`SELECT 1 FROM csm_contracts WHERE contract_id = $1`, [dto.contractId]);
      if (!contract.length) throw new BadRequestException("Select an existing contract.");
    }
    const mappings: Record<string, string> = {
      slaName: "sla_name", slaType: "sla_type", service: "service", contractId: "contract_id",
      appliesTo: "applies_to", priorities: "priorities", responseMinutes: "response_minutes",
      resolutionMinutes: "resolution_minutes", availabilityPercent: "availability_percent",
      escalationPolicy: "escalation_policy", status: "status", description: "description",
    };
    const entries = Object.entries(dto).filter(([key, value]) => mappings[key] && value !== undefined);
    if (entries.length) {
      const values: unknown[] = [];
      const sets = entries.map(([key, value]) => {
        const json = key === "appliesTo" || key === "priorities" || key === "escalationPolicy";
        values.push(json ? JSON.stringify(value) : typeof value === "string" ? value.trim() || null : value);
        return `"${mappings[key]}" = $${values.length}${json ? "::jsonb" : ""}`;
      });
      values.push(id);
      const rows: Row[] = await this.db.query(
        `UPDATE csm_slas SET ${sets.join(", ")}, updated_at = now() WHERE sla_id = $${values.length} RETURNING sla_id`,
        values,
      );
      if (!rows.length) throw new NotFoundException("SLA not found.");
    }
    return (await this.listSlas()).find((item: Row) => item.slaId === id);
  }

  async listEscalations() {
    return this.db.query(`
      SELECT e.escalation_id AS "escalationId", e.escalation_code AS "escalationCode", e.case_id AS "caseId",
        c.case_code AS "caseCode", c.short_description AS "caseTitle", cu.name AS "customerName", cu.customer_type AS "customerType",
        e.escalation_type AS "escalationType", e.level, e.priority, e.target_group_id AS "targetGroupId",
        g.group_name AS "targetGroup", e.target_user_id AS "targetUserId", u.full_name AS "targetUser",
        e.due_by AS "dueBy", e.reason, e.comments, e.recipients, e.status, e.created_at AS "createdAt", e.resolved_at AS "resolvedAt"
      FROM csm_escalations e JOIN csm_cases c ON c.case_id = e.case_id
      JOIN csm_customers cu ON cu.customer_id = c.customer_id
      LEFT JOIN assignment_groups g ON g.group_id = e.target_group_id LEFT JOIN users u ON u.user_id = e.target_user_id
      ORDER BY e.created_at DESC LIMIT 500
    `);
  }

  async createEscalation(userId: number, dto: CreateCsmEscalationDto) {
    const caseItem: Row[] = await this.db.query(`SELECT case_id FROM csm_cases WHERE case_id = $1 AND status NOT IN ('Closed', 'Resolved')`, [dto.caseId]);
    if (!caseItem.length) throw new BadRequestException("Select an open case to escalate.");
    if (new Date(dto.dueBy).getTime() <= Date.now()) throw new BadRequestException("Escalation due date must be in the future.");
    const [row]: Row[] = await this.db.query(`
      INSERT INTO csm_escalations (case_id, escalation_type, level, priority, target_group_id, target_user_id,
        due_by, reason, comments, recipients, send_immediate_notification, escalated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12) RETURNING escalation_id AS "escalationId"
    `, [
      dto.caseId, dto.escalationType.trim(), dto.level.trim(), dto.priority, dto.targetGroupId ?? null,
      dto.targetUserId ?? null, dto.dueBy, dto.reason.trim(), dto.comments?.trim() || null,
      JSON.stringify(dto.recipients ?? []), dto.sendImmediateNotification ?? true, userId,
    ]);
    await this.code("csm_escalations", "escalation_code", row.escalationId, "ESC");
    await this.db.query(
      `INSERT INTO csm_case_activities (case_id, activity_type, content, created_by) VALUES ($1, 'Internal Note', $2, $3)`,
      [dto.caseId, `Escalation created: ${dto.level} (${dto.escalationType}).`, userId],
    );
    const result = (await this.listEscalations()).find((item: Row) => item.escalationId === row.escalationId);
    if (dto.sendImmediateNotification ?? true) await this.notifyEscalation(dto.caseId, dto);
    return result;
  }

  private async notifyEscalation(caseId: number, dto: CreateCsmEscalationDto) {
    const [context]: Row[] = await this.db.query(`
      SELECT c.case_code AS "caseCode", c.short_description AS "shortDescription",
        c.contact_email AS "contactEmail", cu.email AS "customerEmail",
        assigned.email AS "assignedEmail", c.assignment_group_id AS "groupId"
      FROM csm_cases c JOIN csm_customers cu ON cu.customer_id = c.customer_id
      LEFT JOIN users assigned ON assigned.user_id = c.assigned_to
      WHERE c.case_id = $1
    `, [caseId]);
    if (!context) return;
    const emails = new Set<string>(dto.recipients?.filter((recipient) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) ?? []);
    const include = (label: string) => (dto.recipients ?? []).some((recipient) => recipient.toLowerCase() === label.toLowerCase());
    if (include("Customer")) {
      const email = context.contactEmail || context.customerEmail;
      if (email) emails.add(email);
    }
    if (include("Case Owner") && context.assignedEmail) emails.add(context.assignedEmail);
    if (include("Support Group") && context.groupId) {
      const members: Row[] = await this.db.query(`
        SELECT DISTINCT u.email FROM assignment_group_members gm JOIN users u ON u.user_id = gm.user_id
        WHERE gm.group_id = $1 AND u.is_active = true AND u.email IS NOT NULL
      `, [context.groupId]);
      members.forEach((member) => emails.add(member.email));
    }
    if (!emails.size) return;
    const subject = `Case escalation ${context.caseCode}: ${context.shortDescription}`;
    const html = `<p>Case <strong>${escapeHtml(context.caseCode)}</strong> has been escalated.</p>
      <p>${escapeHtml(context.shortDescription)}</p>
      <p><strong>Level:</strong> ${escapeHtml(dto.level)}<br><strong>Priority:</strong> ${escapeHtml(dto.priority)}
      <br><strong>Due by:</strong> ${escapeHtml(dto.dueBy)}<br><strong>Reason:</strong> ${escapeHtml(dto.reason)}</p>`;
    try {
      await this.mail.queue({ to: [...emails], subject, html });
    } catch (error) {
      this.logger.error(`Could not queue escalation notification for ${context.caseCode}: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException("Escalation was saved, but its email notification could not be queued. Contact an administrator before retrying.");
    }
  }

  async updateEscalation(id: number, status: string) {
    if (!["Open", "In Progress", "Resolved"].includes(status)) throw new BadRequestException("Invalid escalation status.");
    const rows: Row[] = await this.db.query(`
      UPDATE csm_escalations SET status = $1, updated_at = now(),
        resolved_at = CASE WHEN $1 = 'Resolved' THEN now() WHEN $1 <> 'Resolved' THEN NULL END
      WHERE escalation_id = $2 RETURNING escalation_id
    `, [status, id]);
    if (!rows.length) throw new NotFoundException("Escalation not found.");
    return (await this.listEscalations()).find((item: Row) => item.escalationId === id);
  }

  async listMajorCases() {
    return this.db.query(`
      SELECT m.major_case_id AS "majorCaseId", m.major_case_code AS "majorCaseCode", m.title, m.description,
        m.product_service AS "productService", m.major_case_type AS "majorCaseType", m.severity,
        m.business_impact AS "businessImpact", m.impact_type AS "impactType", m.estimated_impact AS "estimatedImpact",
        m.owner_id AS "ownerId", owner.full_name AS "ownerName", m.incident_commander_id AS "incidentCommanderId",
        commander.full_name AS "incidentCommander", m.resolver_group_id AS "resolverGroupId",
        rg.group_name AS "resolverGroup", m.coordination_group_id AS "coordinationGroupId",
        cg.group_name AS "coordinationGroup", m.status, m.incident_start AS "incidentStart",
        m.target_restoration AS "targetRestoration", m.notify_customers AS "notifyCustomers",
        m.communication_channels AS "communicationChannels", m.related_case_ids AS "relatedCaseIds",
        m.created_at AS "createdAt", m.resolved_at AS "resolvedAt"
      FROM csm_major_cases m
      LEFT JOIN users owner ON owner.user_id = m.owner_id
      LEFT JOIN users commander ON commander.user_id = m.incident_commander_id
      LEFT JOIN assignment_groups rg ON rg.group_id = m.resolver_group_id
      LEFT JOIN assignment_groups cg ON cg.group_id = m.coordination_group_id
      ORDER BY m.incident_start DESC LIMIT 500
    `);
  }

  async createMajorCase(userId: number, dto: CreateCsmMajorCaseDto) {
    if (new Date(dto.targetRestoration).getTime() <= new Date(dto.incidentStart).getTime()) {
      throw new BadRequestException("Target restoration must be after the incident start.");
    }
    for (const id of dto.relatedCaseIds ?? []) await this.getCase(id);
    const [row]: Row[] = await this.db.query(`
      INSERT INTO csm_major_cases (title, description, product_service, major_case_type, severity, business_impact,
        impact_type, estimated_impact, owner_id, incident_commander_id, resolver_group_id, coordination_group_id,
        status, incident_start, target_restoration, notify_customers, communication_channels, related_case_ids, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19)
      RETURNING major_case_id AS "majorCaseId"
    `, [
      dto.title.trim(), dto.description.trim(), dto.productService.trim(), dto.majorCaseType.trim(), dto.severity,
      dto.businessImpact, dto.impactType.trim(), dto.estimatedImpact?.trim() || null, dto.ownerId ?? null,
      dto.incidentCommanderId ?? null, dto.resolverGroupId ?? null, dto.coordinationGroupId ?? null,
      dto.status ?? "In Coordination", dto.incidentStart, dto.targetRestoration, dto.notifyCustomers ?? true,
      JSON.stringify(dto.communicationChannels ?? []), JSON.stringify(dto.relatedCaseIds ?? []), userId,
    ]);
    await this.code("csm_major_cases", "major_case_code", row.majorCaseId, "MC");
    await this.db.query(
      `INSERT INTO csm_major_case_updates (major_case_id, content, created_by) VALUES ($1, 'Major case created.', $2)`,
      [row.majorCaseId, userId],
    );
    const result = (await this.listMajorCases()).find((item: Row) => item.majorCaseId === row.majorCaseId);
    if (dto.notifyCustomers ?? true) await this.notifyMajorCaseCustomers(row.majorCaseId, "Major case opened", dto.description);
    return result;
  }

  async updateMajorCase(id: number, userId: number, status: string, update: string) {
    if (!["In Coordination", "In Progress", "Monitoring", "Resolved", "Closed"].includes(status)) {
      throw new BadRequestException("Invalid major case status.");
    }
    const rows: Row[] = await this.db.query(`
      UPDATE csm_major_cases SET status = $1, updated_at = now(),
        resolved_at = CASE WHEN $1 IN ('Resolved', 'Closed') THEN now() ELSE NULL END
      WHERE major_case_id = $2 RETURNING major_case_id
    `, [status, id]);
    if (!rows.length) throw new NotFoundException("Major case not found.");
    if (update.trim()) await this.db.query(
      `INSERT INTO csm_major_case_updates (major_case_id, content, created_by) VALUES ($1,$2,$3)`,
      [id, update.trim(), userId],
    );
    if (update.trim()) await this.notifyMajorCaseCustomers(id, `Major case update: ${status}`, update.trim());
    return (await this.listMajorCases()).find((item: Row) => item.majorCaseId === id);
  }

  private async notifyMajorCaseCustomers(majorCaseId: number, subject: string, message: string) {
    const [major]: Row[] = await this.db.query(`
      SELECT major_case_code AS "majorCaseCode", title, notify_customers AS "notifyCustomers",
        communication_channels AS "communicationChannels", related_case_ids AS "relatedCaseIds"
      FROM csm_major_cases WHERE major_case_id = $1
    `, [majorCaseId]);
    if (!major?.notifyCustomers || !(major.communicationChannels ?? []).includes("Email")) return;
    const caseIds: number[] = major.relatedCaseIds ?? [];
    if (!caseIds.length) return;
    const rows: Row[] = await this.db.query(`
      SELECT DISTINCT COALESCE(c.contact_email, cu.email) AS email
      FROM csm_cases c JOIN csm_customers cu ON cu.customer_id = c.customer_id
      WHERE c.case_id = ANY($1::int[]) AND COALESCE(c.contact_email, cu.email) IS NOT NULL
    `, [caseIds]);
    const emails = [...new Set(rows.map((row) => row.email as string))];
    if (!emails.length) return;
    try {
      await this.mail.queue({
        to: emails,
        subject: `${subject}: ${major.majorCaseCode} - ${major.title}`,
        html: `<p>${escapeHtml(major.title)} (${escapeHtml(major.majorCaseCode)})</p><p>${escapeHtml(message)}</p>`,
      });
    } catch (error) {
      this.logger.error(`Could not queue customer notice for ${major.majorCaseCode}: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException("Major case was saved, but customer email could not be queued. Contact an administrator before retrying.");
    }
  }

  async listMajorUpdates(id: number) {
    const exists: Row[] = await this.db.query(`SELECT 1 FROM csm_major_cases WHERE major_case_id = $1`, [id]);
    if (!exists.length) throw new NotFoundException("Major case not found.");
    return this.db.query(`
      SELECT u.update_id AS "updateId", u.content, u.created_at AS "createdAt", usr.full_name AS "createdBy"
      FROM csm_major_case_updates u LEFT JOIN users usr ON usr.user_id = u.created_by
      WHERE u.major_case_id = $1 ORDER BY u.created_at DESC
    `, [id]);
  }

  async listViews(userId: number) {
    return this.db.query(`
      SELECT view_id AS "viewId", view_name AS "viewName", description, filters, is_shared AS "isShared",
        created_by AS "createdById", created_at AS "createdAt"
      FROM csm_case_views WHERE is_shared = true OR created_by = $1 ORDER BY view_name
    `, [userId]);
  }

  async createView(userId: number, dto: CreateCsmViewDto) {
    const [row]: Row[] = await this.db.query(`
      INSERT INTO csm_case_views (view_name, description, filters, is_shared, created_by)
      VALUES ($1,$2,$3::jsonb,$4,$5)
      RETURNING view_id AS "viewId", view_name AS "viewName", description, filters, is_shared AS "isShared"
    `, [dto.viewName.trim(), dto.description?.trim() || null, JSON.stringify(dto.filters), dto.isShared ?? false, userId]);
    return row;
  }

  async lookups() {
    const [groups, users, customers, slas, groupMembers] = await Promise.all([
      this.db.query(`SELECT group_id AS "id", group_name AS label FROM assignment_groups WHERE is_active = true ORDER BY group_name`),
      this.db.query(`SELECT user_id AS id, full_name AS label, email FROM users WHERE is_active = true ORDER BY full_name LIMIT 500`),
      this.db.query(`SELECT customer_id AS id, customer_code AS code, name AS label, customer_type AS type FROM csm_customers WHERE status = 'Active' ORDER BY name LIMIT 500`),
      this.db.query(`SELECT sla_id AS id, sla_name AS label, service FROM csm_slas WHERE status = 'Active' ORDER BY sla_name`),
      this.db.query(`SELECT group_id AS "groupId", user_id AS "userId" FROM assignment_group_members`),
    ]);
    return { groups, users, customers, slas, groupMembers };
  }
}
