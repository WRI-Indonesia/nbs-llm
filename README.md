# Flow Schema Designer 🎨

A modern, visual database schema designer built with Next.js and Prisma. Design your database schemas with an intuitive drag-and-drop interface, then sync directly to your database.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-Latest-2D3748)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- 🎨 **Visual Schema Designer** - Drag-and-drop interface powered by ReactFlow
- 🔗 **Smart Relationships** - Automatic foreign key relationship visualization
- 💾 **Dual Storage Modes** - Choose between local storage or database persistence
- 🗄️ **Prisma Integration** - Direct sync with PostgreSQL, MySQL, or SQLite
- 📦 **Version Control** - Built-in schema version history
- 🤖 **AI Assistant** - Get help with your schema design (demo mode included)
- ⚡ **Auto-save** - Never lose your work
- 🎯 **Auto-layout** - Dagre algorithm for optimal node positioning

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd agent

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Using Local Storage Mode (Default)

No setup required! The app works out of the box with browser localStorage.

### Using Database Mode (Optional)

Want persistent, shareable schemas? Set up a database:

1. **Quick Setup with SQLite:**
```bash
echo 'DATABASE_URL="file:./dev.db"' > .env
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

2. **Or use PostgreSQL:**
```bash
# With Docker
docker run --name postgres-flow \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=flow_schema_db \
  -p 5432:5432 -d postgres

echo 'DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/flow_schema_db"' > .env
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

3. **Toggle to database mode** in the playground (top-left button)

📖 **Full database setup guide:** See [PRISMA_SETUP.md](./PRISMA_SETUP.md)

## 📚 Documentation

- **User Guide**: Visit `/` for step-by-step how-to guides
- **Technical Docs**: Visit `/docs` for architecture and API details
- **Prisma Setup**: See [PRISMA_SETUP.md](./PRISMA_SETUP.md)
- **Environment Config**: See [ENV_EXAMPLE.md](./ENV_EXAMPLE.md)

## 🎯 Usage

### Creating Tables

1. Open the **Playground** at `/playground`
2. Click the **pencil icon** on any table
3. Modify table name, columns, and types
4. Mark columns as Primary Key (PK) or Foreign Key (FK)

### Creating Relationships

1. Drag from a **Foreign Key** handle (right side) 
2. Drop on a **Primary Key** handle (left side)
3. The relationship line appears automatically!

### Storage Modes

Toggle between storage modes using the button in the top-left:

- **🖥️ Local** (Gray) - Fast, browser-only storage
- **💾 Database** (Green) - Persistent, shareable storage

## 🏗️ Project Structure

```
agent/
├── app/
│   ├── api/
│   │   └── schemas/          # API routes for database operations
│   ├── docs/                 # Technical documentation page
│   ├── playground/           # Interactive schema designer
│   ├── page.tsx              # Home page with guides
│   └── layout.tsx            # Root layout
│
├── components/
│   ├── Flow.tsx              # Main flow editor component
│   ├── TableNode.tsx         # Custom table node
│   ├── SidebarChat.tsx       # AI assistant sidebar
│   └── ui/                   # shadcn/ui components
│
├── lib/
│   ├── prisma.ts             # Prisma client singleton
│   ├── schema-storage.ts     # Storage abstraction layer
│   └── utils.ts              # Utility functions
│
├── prisma/
│   └── schema.prisma         # Database schema definition
│
└── types/
    └── index.ts              # TypeScript type definitions
```

## 🛠️ Tech Stack

### Core
- **Next.js 15** - React framework with App Router
- **React 19** - UI library with latest features
- **TypeScript 5** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling

### Database & ORM
- **Prisma** - Type-safe ORM
- **PostgreSQL / MySQL / SQLite** - Database options

### UI & Visualization
- **ReactFlow** - Flow-based graph visualization
- **shadcn/ui** - Component library
- **Radix UI** - Accessible primitives
- **Lucide React** - Icon library
- **Dagre** - Graph layout algorithm

## 📝 Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npx prisma studio    # Open database GUI
npx prisma generate  # Generate Prisma Client
npx prisma migrate dev --name <name>  # Create migration
npx prisma db push   # Push schema without migration
```

## 🌐 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add `DATABASE_URL` environment variable
4. Deploy!

### Self-Hosted

```bash
npm run build
npm start
```

Or use PM2:

```bash
pm2 start npm --name "flow-schema" -- start
```

### Environment Variables

```env
# Required for database mode
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Optional
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NODE_ENV="production"
```

## 🤝 Contributing

Contributions welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards

- Use TypeScript for all new files
- Follow ESLint configuration
- Write JSDoc comments for complex functions
- Keep components under 300 lines
- Place types in `/types` directory

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [ReactFlow](https://reactflow.dev/) - Amazing flow library
- [Prisma](https://www.prisma.io/) - Excellent ORM
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful components
- [Next.js](https://nextjs.org/) - Powerful React framework

## 📞 Support

- 📖 [User Guide](http://localhost:3000)
- 🔧 [Technical Docs](http://localhost:3000/docs)
- 💬 [GitHub Issues](your-repo-url/issues)

## 🎉 What's Next?

- [ ] SQL export functionality
- [ ] Import from existing databases
- [ ] Real AI integration (OpenAI/Anthropic)
- [ ] Collaborative editing
- [ ] Schema templates
- [ ] Migration generation
- [ ] ERD export (PNG/SVG)

---

Built with ❤️ using Next.js, Prisma, and ReactFlow

**Happy Schema Designing! 🚀**
