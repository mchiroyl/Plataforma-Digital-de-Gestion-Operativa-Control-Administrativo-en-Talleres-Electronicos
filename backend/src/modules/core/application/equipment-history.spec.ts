import { CoreService } from './core.service';

describe('CoreService equipment history', () => {
  it('returns the latest order summary with each equipment item', async () => {
    const createdAt = new Date('2026-06-03T10:00:00.000Z');
    const prisma = {
      equipment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 7,
            clientId: 3,
            brand: 'Samsung',
            model: 'SM-A036M',
            serialNumber: null,
            orders: [
              {
                orderCode: 'ORD-2026-00018',
                status: 'EN_REPARACION',
                reportedIssue: 'No carga',
                createdAt,
              },
            ],
          },
        ]),
      },
    };
    const service = new CoreService(prisma as any);

    const result = await service.equipment({ clientId: 3 });

    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          orders: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { orderCode: true, status: true, reportedIssue: true, createdAt: true },
          },
        }),
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 7,
        lastOrder: {
          orderCode: 'ORD-2026-00018',
          status: 'EN_REPARACION',
          reportedIssue: 'No carga',
          createdAt,
        },
      }),
    );
  });
});
