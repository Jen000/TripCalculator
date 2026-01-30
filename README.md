# TripCalculator

A modern web application for tracking and splitting trip expenses among multiple participants. Built with React, TypeScript, and Vite for a fast and efficient user experience.

## Features

- **Expense Tracking**: Add and manage trip expenses with details like description, amount, and payer
- **Expense Splitting**: Automatically calculate how much each person owes or is owed
- **Multiple Participants**: Support for tracking expenses across multiple trip members
- **Real-time Calculations**: Instant updates as you add or modify expenses
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Modern UI**: Clean and intuitive interface for easy expense management

## Tech Stack

- **React 18** - Modern UI framework with React Compiler enabled
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server with HMR (Hot Module Replacement)
- **ESLint** - Code quality and consistency

## Getting Started

### Prerequisites

- Node.js (version 16 or higher recommended)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Jen000/TripCalculator.git
cd TripCalculator
```

2. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (default Vite port).

### Building for Production

Create a production build:
```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

Preview the production build locally:
```bash
npm run preview
```

## Project Structure

```
TripCalculator/
├── public/          # Static assets
├── src/             # Source code
│   ├── components/  # React components
│   ├── styles/      # CSS styles
│   └── ...
├── index.html       # Entry HTML file
├── package.json     # Project dependencies
├── tsconfig.json    # TypeScript configuration
└── vite.config.ts   # Vite configuration
```

## Usage

1. **Add Participants**: Start by adding the names of all trip participants
2. **Record Expenses**: Add expenses with details about who paid and the amount
3. **View Balances**: See who owes money to whom with automatic calculations
4. **Settle Up**: Keep track of settlements as people pay each other back

## Development Notes

### React Compiler

This project uses the React Compiler for optimized performance. Note that this may impact Vite development and build performance during the compilation process.

### ESLint Configuration

The project includes ESLint configuration for code quality. For production applications, consider enabling type-aware lint rules by following the configuration suggestions in the original template documentation.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/Jen000/TripCalculator/issues) on GitHub.

## Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- Powered by [React](https://react.dev/)
- Type-safe with [TypeScript](https://www.typescriptlang.org/)