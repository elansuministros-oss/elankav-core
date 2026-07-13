import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertAllowedKeys,
  normalizeEmail,
  normalizeKey,
  normalizePhone,
  validateClientInput,
  validateSupplierInput
} from '../lib/crm-domain.js';

test('normaliza telefono, correo y clave', () => {
  assert.equal(normalizePhone('+505 8888-7777'), '50588887777');
  assert.equal(normalizeEmail(' Ventas@Proveedor.COM '), 'ventas@proveedor.com');
  assert.equal(normalizeKey('ELAN Visual'), 'elan-visual');
});

test('valida proveedor de materiales', () => {
  const result = validateSupplierInput({
    action: 'create_supplier',
    name: 'Vargas Centro',
    supplierType: 'materials',
    categories: ['vinil', 'lona'],
    phone: '+505 8888-7777'
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.name, 'Vargas Centro');
  assert.equal(result.value.supplierType, 'materials');
  assert.deepEqual(result.value.categories, ['vinil', 'lona']);
  assert.equal(result.value.phone, '50588887777');
});

test('valida proveedor con whatsapp sin campo phone', () => {
  const result = validateSupplierInput({
    action: 'create_supplier',
    name: 'Proveedor WhatsApp',
    supplierType: 'services',
    whatsapp: '+505 8888-7777'
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.whatsapp, '+50588887777');
  assert.equal(result.value.phone, '50588887777');
});

test('acepta whatsapp internacional con codigo de pais sin signo mas', () => {
  const result = validateSupplierInput({
    action: 'create_supplier',
    name: 'Proveedor Internacional',
    supplierType: 'materials',
    whatsapp: '506 8888 7777'
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.whatsapp, '+50688887777');
  assert.equal(result.value.phone, '50688887777');
});

test('rechaza tipo de proveedor desconocido', () => {
  const result = validateSupplierInput({
    action: 'create_supplier',
    name: 'Proveedor X',
    supplierType: 'other'
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'CRM_SUPPLIER_INPUT_INVALID');
});

test('rechaza campos no permitidos en proveedor', () => {
  const result = validateSupplierInput({
    action: 'create_supplier',
    name: 'Proveedor X',
    supplierType: 'services',
    sql: 'drop table crm_identities'
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'CRM_PAYLOAD_FIELDS_INVALID');
  assert.deepEqual(result.fields, ['sql']);
});

test('valida cliente por plataforma', () => {
  const result = validateClientInput({
    action: 'create_client',
    name: 'Comercial San Jose',
    platform: 'ELANVISUAL',
    whatsapp: '+50588887777',
    responsibleCommercialId: '00000000-0000-0000-0000-000000000001'
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.platform, 'elanvisual');
  assert.equal(
    result.value.responsibleCommercialId,
    '00000000-0000-0000-0000-000000000001'
  );
});

test('rechaza cliente sin plataforma', () => {
  const result = validateClientInput({
    action: 'create_client',
    name: 'Comercial San Jose'
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'CRM_CLIENT_INPUT_INVALID');
});

test('lista blanca acepta un contrato valido', () => {
  assert.deepEqual(
    assertAllowedKeys({ name: 'A', platform: 'B' }, ['name', 'platform']),
    { ok: true }
  );
});
