import { ForbiddenException } from '@nestjs/common';
import { CoreController } from './core.controller';

const requestFor = (role: string) => ({ user: { sub: 1, username: role.toLowerCase(), role } }) as any;

describe('CoreController role permissions', () => {
  const core = {
    createExpense: jest.fn(),
    createInventorySale: jest.fn(),
    createSparePart: jest.fn(),
    bulkImportSpareParts: jest.fn(),
    updateSparePart: jest.fn(),
    createClient: jest.fn(),
    createOrder: jest.fn(),
    updateOrder: jest.fn(),
    ordersForUser: jest.fn(),
    equipment: jest.fn(),
    addPayment: jest.fn(),
  };
  let controller: CoreController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CoreController(core as any);
  });

  it('blocks expenses for non-admin roles', () => {
    expect(() =>
      controller.createExpense(
        { category: 'RENTA', description: 'Pago local', amount: 100, paymentMethod: 'EFECTIVO', responsible: 'Admin' },
        requestFor('TECNICO'),
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      controller.createExpense(
        { category: 'RENTA', description: 'Pago local', amount: 100, paymentMethod: 'EFECTIVO', responsible: 'Admin' },
        requestFor('RECEPCIONISTA'),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows expenses for admin', () => {
    core.createExpense.mockReturnValue({ id: 1 });

    expect(
      controller.createExpense(
        { category: 'RENTA', description: 'Pago local', amount: 100, paymentMethod: 'EFECTIVO', responsible: 'Admin' },
        requestFor('ADMIN'),
      ),
    ).toEqual({ id: 1 });
  });

  it('blocks inventory writes for receptionist and technician', () => {
    expect(() =>
      controller.createSparePart(
        { internalCode: 'A1', name: 'Pantalla', category: 'Pantallas', purchasePrice: 10, publicSalePrice: 15 },
        requestFor('TECNICO'),
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      controller.updateSparePart('1', { name: 'Pantalla nueva' }, requestFor('RECEPCIONISTA')),
    ).toThrow(ForbiddenException);
  });

  it('blocks sales for technician and allows receptionist', () => {
    expect(() =>
      controller.createInventorySale(
        { clientId: 1, paymentMethod: 'EFECTIVO', items: [{ sparePartId: 1, quantity: 1, unitPrice: 15 }] },
        requestFor('TECNICO'),
      ),
    ).toThrow(ForbiddenException);

    core.createInventorySale.mockReturnValue({ id: 10 });
    expect(
      controller.createInventorySale(
        { clientId: 1, paymentMethod: 'EFECTIVO', items: [{ sparePartId: 1, quantity: 1, unitPrice: 15 }] },
        requestFor('RECEPCIONISTA'),
      ),
    ).toEqual({ id: 10 });
  });

  it('blocks client creation for technician', () => {
    expect(() =>
      controller.createClient(
        { firstName: 'Cliente', lastName: 'Prueba', phone: '+502 0000 0000' },
        requestFor('TECNICO'),
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks order creation and administrative edits for technician', () => {
    expect(() =>
      controller.createOrder(
        { clientId: 1, equipmentId: 1, reportedIssue: 'No enciende' },
        requestFor('TECNICO'),
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      controller.updateOrder('1', { reportedIssue: 'Pantalla quebrada', technicianId: 2 }, requestFor('TECNICO')),
    ).toThrow(ForbiddenException);
  });

  it('allows order creation for receptionist', () => {
    core.createOrder.mockReturnValue({ id: 20 });

    expect(
      controller.createOrder(
        { clientId: 1, equipmentId: 1, reportedIssue: 'No enciende' },
        requestFor('RECEPCIONISTA'),
      ),
    ).toEqual({ id: 20 });
  });

  it('passes authenticated user to scoped order listing', () => {
    core.ordersForUser.mockReturnValue([{ id: 1 }]);
    const request = requestFor('TECNICO');

    expect(controller.orders(request)).toEqual([{ id: 1 }]);
    expect(core.ordersForUser).toHaveBeenCalledWith(request.user);
  });

  it('blocks equipment listing for technician', () => {
    expect(() => controller.equipment(requestFor('TECNICO'))).toThrow(ForbiddenException);
  });

  it('blocks payment registration for receptionist and technician', () => {
    expect(() =>
      controller.addPayment('1', { amount: 100, paymentMethod: 'EFECTIVO' }, requestFor('RECEPCIONISTA')),
    ).toThrow(ForbiddenException);

    expect(() =>
      controller.addPayment('1', { amount: 100, paymentMethod: 'EFECTIVO' }, requestFor('TECNICO')),
    ).toThrow(ForbiddenException);
  });

  it('allows payment registration only for admin', () => {
    core.addPayment.mockReturnValue({ id: 1 });

    expect(controller.addPayment('1', { amount: 100, paymentMethod: 'EFECTIVO' }, requestFor('ADMIN'))).toEqual({ id: 1 });
  });
});
