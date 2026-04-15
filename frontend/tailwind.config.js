/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cooley: {
          red: '#C8102E',
          'red-hover': '#A80D24',
          'red-light': '#FEF2F4',
          'red-mid': '#F0C0C8',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F6F6F6',
          tertiary: '#EBEBEB',
        },
        border: {
          DEFAULT: '#DCDCDC',
          strong: '#C4C4C4',
        },
        text: {
          DEFAULT: '#1C1C1C',
          dim: '#5A5A5A',
          muted: '#9A9A9A',
        },
        semantic: {
          green: '#1A6E34',
          'green-bg': '#EBF5EE',
          yellow: '#7A5C00',
          'yellow-bg': '#FFFBEB',
          orange: '#92400E',
          'orange-bg': '#FFF7ED',
          blue: '#1E4D8C',
          'blue-bg': '#EFF6FF',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        serif: ['Georgia', '"Times New Roman"', 'serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      borderRadius: {
        cooley: '6px',
      },
    },
  },
  plugins: [],
};
