import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();

  const content = {
    id: {
      title: 'Kebijakan Privasi',
      heading: 'Kebijakan Privasi idCashier',
      lastUpdated: 'Terakhir diperbarui:',
      sections: [
        {
          title: '1. Pendahuluan',
          content: 'idCashier ("kami") menghargai privasi Anda. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi informasi pribadi Anda saat menggunakan layanan Point of Sale (POS) kami.'
        },
        {
          title: '2. Informasi yang Kami Kumpulkan',
          content: 'Kami mengumpulkan informasi berikut untuk memberikan layanan kami:',
          list: [
            'Informasi Akun: Nama, alamat email, nomor telepon, dan kata sandi (terenkripsi).',
            'Informasi Toko: Nama toko, alamat, dan data transaksi penjualan.',
            'Informasi Pembayaran: Riwayat pembayaran langganan. Detail kartu kredit atau rekening bank diproses langsung oleh penyedia layanan pembayaran kami (Duitku) dan tidak disimpan di server kami.'
          ]
        },
        {
          title: '3. Penggunaan Informasi',
          content: 'Kami menggunakan informasi Anda untuk:',
          list: [
            'Menyediakan dan mengelola layanan POS.',
            'Memproses pembayaran langganan melalui mitra kami, Duitku.',
            'Mengirimkan notifikasi terkait akun dan layanan.',
            'Meningkatkan kualitas layanan dan keamanan.'
          ]
        },
        {
          title: '4. Pembagian Informasi dengan Pihak Ketiga',
          content: 'Kami tidak menjual data Anda kepada pihak ketiga. Namun, kami membagikan data tertentu dengan mitra terpercaya untuk operasional layanan:',
          list: [
            'Payment Gateway (Duitku): Kami membagikan nama, email, dan jumlah pembayaran kepada Duitku (PT. Nusa Satu Inti Artha) untuk memproses transaksi pembayaran langganan Anda sesuai dengan standar keamanan yang berlaku.',
            'Infrastruktur Cloud (Supabase): Data Anda disimpan dengan aman menggunakan layanan database Supabase.'
          ]
        },
        {
          title: '5. Keamanan Data',
          content: 'Kami menerapkan langkah-langkah keamanan teknis untuk melindungi data Anda, termasuk enkripsi data saat transit (SSL/TLS) dan enkripsi password. Namun, tidak ada metode transmisi internet yang 100% aman.'
        },
        {
          title: '6. Hak Anda',
          content: 'Anda berhak untuk mengakses, memperbarui, atau meminta penghapusan data akun Anda dengan menghubungi layanan pelanggan kami.'
        },
        {
          title: '7. Perubahan Kebijakan',
          content: 'Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan akan diberitahukan melalui aplikasi atau email.'
        },
        {
          title: '8. Hubungi Kami',
          content: 'Jika Anda memiliki pertanyaan tentang kebijakan ini, silakan hubungi kami di support@idcashier.my.id.'
        }
      ]
    },
    en: {
      title: 'Privacy Policy',
      heading: 'idCashier Privacy Policy',
      lastUpdated: 'Last updated:',
      sections: [
        {
          title: '1. Introduction',
          content: 'idCashier ("we") values your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when using our Point of Sale (POS) services.'
        },
        {
          title: '2. Information We Collect',
          content: 'We collect the following information to provide our services:',
          list: [
            'Account Information: Name, email address, phone number, and password (encrypted).',
            'Store Information: Store name, address, and sales transaction data.',
            'Payment Information: Subscription payment history. Credit card or bank account details are processed directly by our payment service provider (Duitku) and are not stored on our servers.'
          ]
        },
        {
          title: '3. Use of Information',
          content: 'We use your information to:',
          list: [
            'Provide and manage POS services.',
            'Process subscription payments through our partner, Duitku.',
            'Send account and service-related notifications.',
            'Improve service quality and security.'
          ]
        },
        {
          title: '4. Information Sharing with Third Parties',
          content: 'We do not sell your data to third parties. However, we share certain data with trusted partners for service operations:',
          list: [
            'Payment Gateway (Duitku): We share name, email, and payment amount with Duitku (PT. Nusa Satu Inti Artha) to process your subscription payment transactions in accordance with applicable security standards.',
            'Cloud Infrastructure (Supabase): Your data is securely stored using Supabase database services.'
          ]
        },
        {
          title: '5. Data Security',
          content: 'We implement technical security measures to protect your data, including data encryption in transit (SSL/TLS) and password encryption. However, no method of internet transmission is 100% secure.'
        },
        {
          title: '6. Your Rights',
          content: 'You have the right to access, update, or request deletion of your account data by contacting our customer service.'
        },
        {
          title: '7. Policy Changes',
          content: 'We may update this Privacy Policy from time to time. Changes will be notified through the application or email.'
        },
        {
          title: '8. Contact Us',
          content: 'If you have any questions about this policy, please contact us at support@idcashier.my.id.'
        }
      ]
    },
    zh: {
      title: '隐私政策',
      heading: 'idCashier 隐私政策',
      lastUpdated: '最后更新:',
      sections: [
        {
          title: '1. 介绍',
          content: 'idCashier（"我们"）重视您的隐私。本隐私政策解释了我们在使用我们的销售点 (POS) 服务时如何收集、使用和保护您的个人信息。'
        },
        {
          title: '2. 我们收集的信息',
          content: '我们收集以下信息以提供我们的服务：',
          list: [
            '帐户信息：姓名、电子邮件地址、电话号码和密码（加密）。',
            '商店信息：商店名称、地址和销售交易数据。',
            '付款信息：订阅付款记录。信用卡或银行帐户详细信息由我们的支付服务提供商 (Duitku) 直接处理，不会存储在我们的服务器上。'
          ]
        },
        {
          title: '3. 信息使用',
          content: '我们将您的信息用于：',
          list: [
            '提供和管理 POS 服务。',
            '通过我们的合作伙伴 Duitku 处理订阅付款。',
            '发送帐户和服务相关通知。',
            '提高服务质量和安全性。'
          ]
        },
        {
          title: '4. 与第三方共享信息',
          content: '我们不会将您的数据出售给第三方。但是，我们与受信任的合作伙伴共享某些数据以进行服务运营：',
          list: [
            '支付网关 (Duitku)：我们与 Duitku (PT. Nusa Satu Inti Artha) 共享姓名、电子邮件和付款金额，以按照适用的安全标准处理您的订阅付款交易。',
            '云基础设施 (Supabase)：您的数据使用 Supabase 数据库服务安全存储。'
          ]
        },
        {
          title: '5. 数据安全',
          content: '我们实施技术安全措施来保护您的数据，包括传输中的数据加密 (SSL/TLS) 和密码加密。但是，没有任何互联网传输方法是 100% 安全的。'
        },
        {
          title: '6. 您的权利',
          content: '您有权通过联系我们的客户服务来访问、更新或请求删除您的帐户数据。'
        },
        {
          title: '7. 政策变更',
          content: '我们会不时更新本隐私政策。变更将通过应用程序或电子邮件通知。'
        },
        {
          title: '8. 联系我们',
          content: '如果您对本政策有任何疑问，请通过 support@idcashier.my.id 联系我们。'
        }
      ]
    }
  };

  const currentContent = content[language] || content.en;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b p-4 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">{currentContent.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              <option value="id">ID</option>
              <option value="en">EN</option>
              <option value="zh">ZH</option>
            </select>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-4xl prose dark:prose-invert">
        <h1 className="text-3xl font-bold mb-6">{currentContent.heading}</h1>
        <p className="text-muted-foreground mb-8">
          {currentContent.lastUpdated} {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : language === 'zh' ? 'zh-CN' : 'en-US')}
        </p>

        {currentContent.sections.map((section, index) => (
          <section key={index} className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>
            {section.content && <p>{section.content}</p>}
            {section.list && (
              <ul className="list-disc pl-6 space-y-2">
                {section.list.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
