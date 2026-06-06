import { CoreService } from './core.service';

describe('CoreService orders role scope', () => {
  const prisma = {
    repairOrder: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters technician orders by the authenticated technician user id', async () => {
    prisma.repairOrder.findMany.mockResolvedValue([]);
    const service = new CoreService(prisma as any);

    await service.ordersForUser({ sub: 7, username: 'tecnico', role: 'TECNICO' });

    expect(prisma.repairOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { technician: { userId: 7 } },
      }),
    );
  });

  it('does not filter admin or receptionist orders by technician', async () => {
    prisma.repairOrder.findMany.mockResolvedValue([]);
    const service = new CoreService(prisma as any);

    await service.ordersForUser({ sub: 1, username: 'admin', role: 'ADMIN' });

    expect(prisma.repairOrder.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        where: expect.anything(),
      }),
    );
  });
});
