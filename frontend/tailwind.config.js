/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Blue / cream / navy.
      //
      // `alert` and `amber` are deliberately NOT on the blue axis: they mean
      // danger and moderate, and carry that meaning in risk badges, risk
      // readouts, the destructive button and every form error. A blue error
      // message reads as ordinary text, so they stay red and amber. Everything
      // decorative that happened to use them has moved to `navy`.
      colors: {
        ink: '#0C2340',
        paper: '#F8F4EA',
        surface: '#FFFFFF',
        pulse: {
          DEFAULT: '#2A6DB0',
          dim: '#DEEAF6',
          dark: '#1A4C80',
          light: '#6FA3DB',
        },
        navy: '#14456F',
        amber: '#B4722A',
        alert: '#B03A3A',
        muted: '#556579',
        line: '#DCE3EB',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [],
}
