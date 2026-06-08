export function registrarOperacionCentral(data) {
  console.log('Operación recibida:', data);

  return {
    success: true,
    data,
  };
}
