/** Pide acceso a cámara o micrófono; en el navegador es `navigator.mediaDevices.getUserMedia`. */
export type PedirMedios = (restricciones: MediaStreamConstraints) => Promise<MediaStream>

export interface Dispositivos {
  camara: boolean
  microfono: boolean
}

/**
 * Hallazgo 15: la cámara es obligatoria para transmitir y el micrófono es opcional. Se piden por separado para
 * que un micrófono ausente o negado no se confunda con un problema de la cámara.
 * Solo comprueba el permiso: las pistas de prueba se detienen enseguida.
 */
export async function verificarDispositivos(pedir: PedirMedios): Promise<Dispositivos> {
  const camara = await probar(pedir, { video: true })
  if (!camara) return { camara: false, microfono: false }
  const microfono = await probar(pedir, { audio: true })
  return { camara, microfono }
}

async function probar(pedir: PedirMedios, restricciones: MediaStreamConstraints): Promise<boolean> {
  try {
    const prueba = await pedir(restricciones)
    prueba.getTracks().forEach((pista) => pista.stop())
    return true
  } catch {
    return false
  }
}
