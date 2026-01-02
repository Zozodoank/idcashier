# idCashier - Modern Point of Sale System

idCashier is a comprehensive Point of Sale (POS) and inventory management system designed for modern businesses. Built with React, Vite, and Supabase, it offers a robust solution for managing sales, products, inventory, and customers with support for multi-tenancy.

## 🚀 Features

- **Point of Sale**: Fast and intuitive checkout interface with barcode scanning support.
- **Inventory Management**: Real-time tracking of stock levels, product categories, and suppliers.
- **Multi-Tenancy**: Secure data isolation for multiple business owners.
- **User Management**: Role-based access control (Owner, Admin, Cashier).
- **Reporting & Analytics**: Detailed sales reports, profit tracking, and business insights.
- **Payment Integration**: Integrated with Duitku for secure payment processing.
- **Mobile Ready**: Optimized for mobile devices using Capacitor.
- **Offline Capable**: Basic offline functionality for uninterrupted sales.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher recommended)
- npm or pnpm
- A Supabase account

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/projectmandiri10-lang/idcashier.git
   cd idcashier
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy the example environment file and update it with your credentials:
   ```bash
   cp .env.example .env
   ```
   
   See `.env.example` for the required variables. You will need:
   - Supabase Project URL and Anon Key
   - Service Role Key (for admin tasks)
   - Site URL
   - SMTP Credentials (for emails)
   - Duitku Credentials (for payments)

4. **Database Setup**
   The project includes SQL migrations and seed scripts.
   
   Apply the schema to your Supabase project:
   ```bash
   npm run supabase:apply-schema
   ```

   Seed initial data (optional):
   ```bash
   npm run db:seed
   ```

## 💻 Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000` (or the port shown in your terminal).

## 🏗️ Building for Production

To create a production build:

```bash
npm run build
```

This will generate a `dist` directory with the compiled assets.

## 📱 Mobile Development

To run on Android/iOS (using Capacitor):

1. **Sync Capacitor config**
   ```bash
   npx cap sync
   ```

2. **Open native IDE**
   ```bash
   npx cap open android
   # or
   npx cap open ios
   ```

## 🧪 Testing

(Coming soon)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.
