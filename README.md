# UV Annotator

A modern React + TypeScript application for interactive 3D annotation and visualization using Three.js and Konva canvas.

## Features

- 🎨 **Interactive 3D Canvas** - Powered by React Three Fiber for smooth 3D visualization
- 🖼️ **2D Annotation Tools** - Konva-based canvas for precise 2D annotations
- ⚡ **Real-time Updates** - HMR support for instant feedback during development
- 🎭 **Smooth Animations** - Framer Motion for polished UI interactions
- 💾 **Persistent Storage** - IndexedDB integration for local data persistence
- 🔄 **Undo/Redo Support** - Zundo integration for state management and history
- 🎨 **Modern UI** - Tailwind CSS with shadcn/ui components
- 📱 **Responsive Layout** - React Resizable Panels for flexible layouts

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Three.js** - 3D graphics
- **React Three Fiber** - React renderer for Three.js
- **Konva** - 2D canvas library
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Zustand** - State management
- **Zundo** - Undo/redo middleware

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

```bash
git clone https://github.com/Orsbert/uv-annotator.git
cd uv-annotator
npm install
```

### Development

Start the development server with hot module replacement:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building

Build for production:

```bash
npm run build
```

### Linting

Check code quality:

```bash
npm run lint
```

### Preview

Preview the production build locally:

```bash
npm run preview
```

## Project Structure

```
src/
├── components/     # Reusable React components
├── pages/          # Page components
├── hooks/          # Custom React hooks
├── stores/         # Zustand state stores
├── lib/            # Utility functions and helpers
├── App.tsx         # Main app component
└── main.tsx        # Application entry point
```

## Configuration

### ESLint

The project uses ESLint for code quality. For production applications, enable type-aware lint rules in `eslint.config.js`:

```js
tseslint.configs.recommendedTypeChecked,
// or for stricter rules:
tseslint.configs.strictTypeChecked,
```

### TypeScript

Configuration files:
- `tsconfig.app.json` - App-specific settings
- `tsconfig.node.json` - Node/Vite settings

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Steps to Contribute

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please open an [issue](https://github.com/Orsbert/uv-annotator/issues) on GitHub.

## Acknowledgments

- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) - React renderer for Three.js
- [Konva](https://konvajs.org/) - HTML5 2D Canvas Library
- [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework
