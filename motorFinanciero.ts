export interface InputSimulacion {
  precioVehiculo: number;
  porcCuotaInicial: number;
  tipoTasa: 'Nominal' | 'Efectiva';
  tasaInteres: number;
  capTasa: number;
  plazoMeses: number;
  porcCuotaFinal: number;
  tasaDesgravamen: number;
  montoSeguroVehic: number;
  mesesGraciaTo: number;
  mesesGraciaPa: number;
  cokAnual: number;
}

export interface DetalleMes {
  numeroCuota: number;
  saldoInicial: number;
  interes: number;
  cuota: number;
  amortizacion: number;
  seguroDesgravamen: number;
  seguroVehicular: number;
  saldoFinal: number;
  tipoGracia: 'sin gracia' | 'total' | 'parcial';
}

export interface ResultadoSimulacion {
  montoPrestamo: number;
  montoCuotaFin: number;
  tem: number;
  cuotaMensual: number;
  interesTotal: number;
  tcea: number;
  van: number;
  tir: number;
  cronograma: DetalleMes[];
}

const calcularVAN = (flujos: number[], numPeriodos: number, cok: number): number => {
  let suma = 0;
  for (let t = 0; t <= numPeriodos; t++) {
    suma += flujos[t] / Math.pow(1 + cok, t);
  }
  return suma;
};

const calcularTIR = (flujos: number[], numPeriodos: number): number => {
  let limiteInf = -0.99;
  let limiteSup = 1.0;
  let tolerancia = 0.00001;
  let maxIter = 1000;
  let iteracion = 0;
  let vanEstimado = 1.0;
  let tirEstimada = 0.0;

  while (Math.abs(vanEstimado) > tolerancia && iteracion < maxIter) {
    tirEstimada = (limiteInf + limiteSup) / 2;
    vanEstimado = calcularVAN(flujos, numPeriodos, tirEstimada);
    if (vanEstimado > 0) {
      limiteInf = tirEstimada;
    } else {
      limiteSup = tirEstimada;
    }
    iteracion++;
  }
  return tirEstimada;
};

export const calcularSmartBuy = (input: InputSimulacion): ResultadoSimulacion => {
  const {
    precioVehiculo,
    porcCuotaInicial,
    tipoTasa,
    tasaInteres,
    capTasa,
    plazoMeses,
    porcCuotaFinal,
    tasaDesgravamen,
    montoSeguroVehic,
    mesesGraciaTo,
    mesesGraciaPa,
    cokAnual,
  } = input;

  const cuotaInicialMonto = precioVehiculo * porcCuotaInicial;
  let saldoActual = precioVehiculo - cuotaInicialMonto;
  const montoPrestamo = saldoActual;
  const montoCuotaFin = precioVehiculo * porcCuotaFinal;

  let tem = 0;
  if (tipoTasa === 'Nominal') {
    tem = Math.pow(1 + (tasaInteres / (360 / capTasa)), 30 / capTasa) - 1;
  } else {
    tem = Math.pow(1 + tasaInteres, 30 / 360) - 1;
  }

  const cokMensual = Math.pow(1 + cokAnual, 30 / 360) - 1;
  const cronograma: DetalleMes[] = [];
  const flujoDeCaja: number[] = [];
  
  flujoDeCaja.push(-montoPrestamo);

  let mesActual = 1;
  let interesTotal = 0;

for (let i = 0; i < mesesGraciaTo; i++) {
    const saldoInicial = saldoActual;
    const interes = saldoInicial * tem;
    const seguroDesgravamen = saldoInicial * tasaDesgravamen;
    
    interesTotal += interes;
    
    const cuotaTotal = 0; 
    
    saldoActual = saldoInicial + interes;

    cronograma.push({
      numeroCuota: mesActual,
      saldoInicial,
      interes,
      cuota: 0,
      amortizacion: 0,
      seguroDesgravamen,
      seguroVehicular: montoSeguroVehic,
      saldoFinal: saldoActual,
      tipoGracia: 'total',
    });
    flujoDeCaja.push(cuotaTotal); // Ahora esto empujará 0.00 al flujo
    mesActual++;
  }

  for (let i = 0; i < mesesGraciaPa; i++) {
    const saldoInicial = saldoActual;
    const interes = saldoInicial * tem;
    const seguroDesgravamen = saldoInicial * tasaDesgravamen;
    
    interesTotal += interes;
    const cuotaTotal = interes + seguroDesgravamen + montoSeguroVehic;

    cronograma.push({
      numeroCuota: mesActual,
      saldoInicial,
      interes,
      cuota: interes,
      amortizacion: 0,
      seguroDesgravamen,
      seguroVehicular: montoSeguroVehic,
      saldoFinal: saldoActual,
      tipoGracia: 'parcial',
    });
    flujoDeCaja.push(cuotaTotal);
    mesActual++;
  }

  const mesesRestantes = plazoMeses - mesesGraciaTo - mesesGraciaPa;
  const factor = Math.pow(1 + tem, mesesRestantes);
  const cuotaMensualBase = (saldoActual * factor - montoCuotaFin) * (tem / (factor - 1));

  for (let i = 0; i < mesesRestantes; i++) {
    const saldoInicial = saldoActual;
    const interes = saldoInicial * tem;
    const seguroDesgravamen = saldoInicial * tasaDesgravamen;
    
    interesTotal += interes;
    const esUltimoMes = (mesActual === plazoMeses);
    const cuotaPrestamo = esUltimoMes ? cuotaMensualBase + montoCuotaFin : cuotaMensualBase;
    
    const amortizacion = cuotaPrestamo - interes;
    const cuotaTotal = cuotaPrestamo + seguroDesgravamen + montoSeguroVehic;
    saldoActual = saldoInicial - amortizacion;

    cronograma.push({
      numeroCuota: mesActual,
      saldoInicial,
      interes,
      cuota: cuotaMensualBase,
      amortizacion,
      seguroDesgravamen,
      seguroVehicular: montoSeguroVehic,
      saldoFinal: esUltimoMes ? 0 : saldoActual,
      tipoGracia: 'sin gracia',
    });
    flujoDeCaja.push(cuotaTotal);
    mesActual++;
  }

  const tirMensual = calcularTIR(flujoDeCaja, plazoMeses);
  const tcea = Math.pow(1 + tirMensual, 12) - 1;
  
  const van = -calcularVAN(flujoDeCaja, plazoMeses, cokMensual);

  return {
    montoPrestamo,
    montoCuotaFin,
    tem,
    cuotaMensual: cuotaMensualBase,
    interesTotal,
    tcea,
    van,
    tir: tirMensual,
    cronograma,
  };
};