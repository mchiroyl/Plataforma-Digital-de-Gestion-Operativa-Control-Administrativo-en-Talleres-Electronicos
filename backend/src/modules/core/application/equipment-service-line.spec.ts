import { shouldRequestEquipmentCredential } from './equipment-service-line';

describe('equipment service line rules', () => {
  it('requests credentials for telefonia equipment', () => {
    expect(
      shouldRequestEquipmentCredential({
        serviceLine: 'TELEFONIA',
        equipmentTypeRequiresCredential: false,
        selectedFaultRequiresCredential: false,
      }),
    ).toBe(true);
  });

  it('does not request credentials for general equipment by default', () => {
    expect(
      shouldRequestEquipmentCredential({
        serviceLine: 'EQUIPOS_GENERALES',
        equipmentTypeRequiresCredential: false,
        selectedFaultRequiresCredential: false,
      }),
    ).toBe(false);
  });

  it('requests credentials for computing equipment only when the type or fault requires it', () => {
    expect(
      shouldRequestEquipmentCredential({
        serviceLine: 'EQUIPOS_DE_COMPUTO',
        equipmentTypeRequiresCredential: true,
        selectedFaultRequiresCredential: false,
      }),
    ).toBe(true);
  });
});
