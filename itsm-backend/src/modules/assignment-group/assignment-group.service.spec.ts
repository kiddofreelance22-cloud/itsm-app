import type { Repository } from 'typeorm';
import { Incident } from '../incidents/entities/incident.entity';
import { User } from '../users/entities/user.entity';
import { AssignmentGroup } from './entities/assignment-group.entity';
import { AssignmentGroupService } from './assignment-group.service';

describe('AssignmentGroupService', () => {
  it('returns grouped incident counts and zeroes for member groups without matching incidents', async () => {
    const groups = [
      {
        groupId: 1,
        groupName: 'Alpha',
        groupCode: 'ALPHA',
        members: [{ userId: 7 }],
      },
      {
        groupId: 2,
        groupName: 'Beta',
        groupCode: 'BETA',
        members: [{ userId: 7 }],
      },
    ] as AssignmentGroup[];
    const queryBuilder = {
      leftJoin: jest.fn(),
      select: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      setParameters: jest.fn(),
      groupBy: jest.fn(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          groupId: 1,
          assignedToMe: '2',
          totalIncidents: '5',
          resolvedTickets: '3',
        },
      ]),
    };
    queryBuilder.leftJoin.mockReturnValue(queryBuilder);
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.addSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.setParameters.mockReturnValue(queryBuilder);
    queryBuilder.groupBy.mockReturnValue(queryBuilder);

    const groupRepo = { find: jest.fn().mockResolvedValue(groups) };
    const incidentRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new AssignmentGroupService(
      groupRepo as unknown as Repository<AssignmentGroup>,
      {} as Repository<User>,
      incidentRepo as unknown as Repository<Incident>,
    );

    await expect(service.getMyWorkgroups(7)).resolves.toEqual([
      {
        groupId: 1,
        groupName: 'Alpha',
        groupCode: 'ALPHA',
        assignedToMe: 2,
        totalIncidents: 5,
        resolvedTickets: 3,
      },
      {
        groupId: 2,
        groupName: 'Beta',
        groupCode: 'BETA',
        assignedToMe: 0,
        totalIncidents: 0,
        resolvedTickets: 0,
      },
    ]);
    expect(incidentRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(queryBuilder.getRawMany).toHaveBeenCalledTimes(1);
  });

  it('skips the incident query when the user has no workgroups', async () => {
    const groupRepo = { find: jest.fn().mockResolvedValue([]) };
    const incidentRepo = { createQueryBuilder: jest.fn() };
    const service = new AssignmentGroupService(
      groupRepo as unknown as Repository<AssignmentGroup>,
      {} as Repository<User>,
      incidentRepo as unknown as Repository<Incident>,
    );

    await expect(service.getMyWorkgroups(7)).resolves.toEqual([]);
    expect(incidentRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
