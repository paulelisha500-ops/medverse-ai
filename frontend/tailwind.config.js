/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Red / cream / burgundy. The palette was previously coffee-brown; the
      // token names are kept so every existing class keeps working, but the
      // values now sit on the red axis with no brown left in them.
      colors: {
        ink: '#2A1418',
        paper: '#FAF2EE',
        surface: '#FFFFFF',
        pulse: {
          DEFAULT: '#A32E35',
          dim: '#F7E3E1',
          dark: '#6E1F24',
        },
        amber: '#C2542F',
        alert: '#A83C3C',
        muted: '#7C6167',
        line: '#EBD9D3',
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
      keyframes: {
        // The marquee track renders its list twice, so shifting by exactly
        // -50% lands the copy where the original started — a seamless loop.
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        beam: {
          from: { offsetDistance: '0%' },
          to: { offsetDistance: '100%' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        marquee: 'marquee 38s linear infinite',
        beam: 'beam 6s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
}
