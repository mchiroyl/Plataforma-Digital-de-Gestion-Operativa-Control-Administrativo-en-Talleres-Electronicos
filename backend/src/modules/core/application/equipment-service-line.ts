export type ServiceLine = 'TELEFONIA' | 'EQUIPOS_GENERALES' | 'EQUIPOS_DE_COMPUTO';

export function shouldRequestEquipmentCredential(input: {
  serviceLine?: ServiceLine | string | null;
  equipmentTypeRequiresCredential?: boolean | null;
  selectedFaultRequiresCredential?: boolean | null;
}) {
  return Boolean(
    input.serviceLine === 'TELEFONIA'
      || input.equipmentTypeRequiresCredential
      || input.selectedFaultRequiresCredential,
  );
}
