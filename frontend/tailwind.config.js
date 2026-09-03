/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#2E1F16',
        paper: '#F7F1E8',
        surface: '#FFFFFF',
        pulse: {
          DEFAULT: '#6F4E37',
          dim: '#EFE3D6',
          dark: '#4A3222',
        },
        amber: '#B8752E',
        alert: '#A83C3C',
        muted: '#7A6A5D',
        line: '#E4D9C9',
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
