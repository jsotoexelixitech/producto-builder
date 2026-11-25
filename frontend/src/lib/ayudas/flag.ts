// Interruptor de compilación de las ayudas visuales. `VITE_UI_AYUDAS=0` en el build apaga TODO (incluido el interruptor).
export const AYUDAS_DISPONIBLES: boolean = import.meta.env.VITE_UI_AYUDAS !== '0';
