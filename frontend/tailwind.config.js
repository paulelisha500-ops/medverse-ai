/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#10231F',
        paper: '#EFF2EF',
        surface: '#FFFFFF',
        pulse: {
          DEFAULT: '#1F8A70',
          dim: '#E4F1EC',
          dark: '#15604F',
        },
        amber: '#B8752E',
        alert: '#A83C3C',
        muted: '#5C6B66',
        line: '#DDE3DF',
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
