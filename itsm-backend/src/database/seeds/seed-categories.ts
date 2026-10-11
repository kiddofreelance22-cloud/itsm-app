import { DataSource } from "typeorm";
import { randomUUID } from "crypto";

/**
 * Seeds the Category and SubCategory tables with IT service management categories.
 * Parent categories are created first, then subcategories are linked to them.
 */
export async function seedCategories(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("Clearing existing categories and subcategories...");
    await queryRunner.query(`DELETE FROM "sub_categories"`);
    await queryRunner.query(`DELETE FROM "categories"`);

    console.log("Seeding parent categories...");
    const parentCategories = [
      {
        categoryName: "Hardware",
        categoryCode: "CAT_HARDWARE",
        description: "Hardware-related incidents",
        displayOrder: 1,
        icon: "Cpu",
      },
      {
        categoryName: "Software",
        categoryCode: "CAT_SOFTWARE",
        description: "Software and application-related incidents",
        displayOrder: 2,
        icon: "Code",
      },
      {
        categoryName: "Network",
        categoryCode: "CAT_NETWORK",
        description: "Network connectivity and configuration issues",
        displayOrder: 3,
        icon: "Wifi",
      },
      {
        categoryName: "Email",
        categoryCode: "CAT_EMAIL",
        description: "Email and collaboration service issues",
        displayOrder: 4,
        icon: "Mail",
      },
      {
        categoryName: "Access & Security",
        categoryCode: "CAT_ACCESS",
        description: "User access and security-related issues",
        displayOrder: 5,
        icon: "Lock",
      },
      {
        categoryName: "Database",
        categoryCode: "CAT_DATABASE",
        description: "Database and data management issues",
        displayOrder: 6,
        icon: "Database",
      },
    ];

    const categoryIdMap: Record<string, number> = {};

    for (const cat of parentCategories) {
      const nodeUuid = randomUUID();
      const result = await queryRunner.query(
        `
        INSERT INTO "categories" ("node_uuid", "category_name", "category_code", "description", "display_order", "icon", "is_active", "available_in_portal", "available_in_mobile", "created_at", "updated_at")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
        RETURNING "category_id"
      `,
        [
          nodeUuid,
          cat.categoryName,
          cat.categoryCode,
          cat.description,
          cat.displayOrder,
          cat.icon,
          true,
          true,
          true,
        ]
      );

      categoryIdMap[cat.categoryCode] = result[0].category_id;
    }

    console.log(`  - Seeded ${parentCategories.length} parent categories`);

    console.log("Seeding subcategories...");
    const subCategories = [
      // Hardware subcategories
      {
        subCategoryName: "Laptop/Desktop Issue",
        subCategoryCode: "SUBCAT_HW_DESKTOP",
        parentCode: "CAT_HARDWARE",
        description: "Issues with laptops or desktop computers",
      },
      {
        subCategoryName: "Printer Issue",
        subCategoryCode: "SUBCAT_HW_PRINTER",
        parentCode: "CAT_HARDWARE",
        description: "Printer connectivity and performance issues",
      },
      {
        subCategoryName: "Storage Device",
        subCategoryCode: "SUBCAT_HW_STORAGE",
        parentCode: "CAT_HARDWARE",
        description: "Issues with external storage or internal drives",
      },
      // Software subcategories
      {
        subCategoryName: "Application Crash",
        subCategoryCode: "SUBCAT_SW_CRASH",
        parentCode: "CAT_SOFTWARE",
        description: "Application crashes or unexpected closures",
      },
      {
        subCategoryName: "Installation Error",
        subCategoryCode: "SUBCAT_SW_INSTALL",
        parentCode: "CAT_SOFTWARE",
        description: "Software installation or update issues",
      },
      {
        subCategoryName: "License Issue",
        subCategoryCode: "SUBCAT_SW_LICENSE",
        parentCode: "CAT_SOFTWARE",
        description: "Software licensing and activation problems",
      },
      // Network subcategories
      {
        subCategoryName: "No Internet Connection",
        subCategoryCode: "SUBCAT_NET_INTERNET",
        parentCode: "CAT_NETWORK",
        description: "No internet or network connectivity",
      },
      {
        subCategoryName: "WiFi Connection",
        subCategoryCode: "SUBCAT_NET_WIFI",
        parentCode: "CAT_NETWORK",
        description: "WiFi connectivity issues",
      },
      {
        subCategoryName: "VPN Issue",
        subCategoryCode: "SUBCAT_NET_VPN",
        parentCode: "CAT_NETWORK",
        description: "VPN connection problems",
      },
      // Email subcategories
      {
        subCategoryName: "Email Sync",
        subCategoryCode: "SUBCAT_EMAIL_SYNC",
        parentCode: "CAT_EMAIL",
        description: "Email synchronization issues",
      },
      {
        subCategoryName: "Calendar Sharing",
        subCategoryCode: "SUBCAT_EMAIL_CALENDAR",
        parentCode: "CAT_EMAIL",
        description: "Calendar and meeting invitation issues",
      },
      // Access & Security subcategories
      {
        subCategoryName: "Password Reset",
        subCategoryCode: "SUBCAT_ACC_PASSWORD",
        parentCode: "CAT_ACCESS",
        description: "Password reset and recovery",
      },
      {
        subCategoryName: "Account Lockout",
        subCategoryCode: "SUBCAT_ACC_LOCKOUT",
        parentCode: "CAT_ACCESS",
        description: "Account locked or disabled issues",
      },
      {
        subCategoryName: "Permission Denied",
        subCategoryCode: "SUBCAT_ACC_PERMISSION",
        parentCode: "CAT_ACCESS",
        description: "Access denied or insufficient permissions",
      },
      // Database subcategories
      {
        subCategoryName: "Database Performance",
        subCategoryCode: "SUBCAT_DB_PERF",
        parentCode: "CAT_DATABASE",
        description: "Database performance and optimization issues",
      },
      {
        subCategoryName: "Data Recovery",
        subCategoryCode: "SUBCAT_DB_RECOVERY",
        parentCode: "CAT_DATABASE",
        description: "Data recovery and backup issues",
      },
    ];

    for (const subCat of subCategories) {
      const categoryId = categoryIdMap[subCat.parentCode];

      if (!categoryId) {
        console.warn(
          `  - Warning: Parent category ${subCat.parentCode} not found for subcategory ${subCat.subCategoryName}`
        );
        continue;
      }

      await queryRunner.query(
        `
        INSERT INTO "sub_categories" ("sub_category_name", "sub_category_code", "description", "category_id", "is_active", "created_at")
        VALUES ($1, $2, $3, $4, $5, now())
      `,
        [subCat.subCategoryName, subCat.subCategoryCode, subCat.description, categoryId, true]
      );
    }

    console.log(`  - Seeded ${subCategories.length} subcategories`);
  } finally {
    await queryRunner.release();
  }
}
