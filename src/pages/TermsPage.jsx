import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TermsPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();

  const content = {
    id: {
      title: 'Syarat & Ketentuan',
      heading: 'Syarat dan Ketentuan Layanan',
      lastUpdated: 'Terakhir diperbarui:',
      sections: [
        {
          title: '1. Ketentuan Umum',
          content: 'Dengan mengakses dan menggunakan idCashier, Anda menyetujui untuk terikat oleh syarat dan ketentuan ini. Jika Anda tidak setuju, Anda tidak diperkenankan menggunakan layanan kami.'
        },
        {
          title: '2. Layanan',
          content: 'idCashier menyediakan layanan sistem Point of Sale (POS) berbasis cloud untuk membantu pengelolaan bisnis Anda. Kami berhak memperbarui, mengubah, atau menghentikan fitur layanan sewaktu-waktu.'
        },
        {
          title: '3. Akun Pengguna',
          list: [
            'Anda bertanggung jawab untuk menjaga kerahasiaan informasi akun dan kata sandi Anda.',
            'Anda setuju untuk memberikan informasi yang akurat dan lengkap saat pendaftaran.',
            'Penyalahgunaan akun untuk aktivitas ilegal dilarang keras.'
          ]
        },
        {
          title: '4. Pembayaran dan Langganan',
          list: [
            'Layanan idCashier tersedia dengan model berlangganan (bulanan/tahunan).',
            'Gateway Pembayaran: Pembayaran diproses melalui mitra resmi kami, Duitku. Dengan melakukan pembayaran, Anda tunduk pada syarat dan ketentuan yang berlaku di Duitku.',
            'Pengembalian Dana (Refund): Biaya langganan yang telah dibayarkan tidak dapat dikembalikan (non-refundable), kecuali diwajibkan oleh hukum yang berlaku.'
          ]
        },
        {
          title: '5. Batasan Tanggung Jawab',
          content: 'idCashier tidak bertanggung jawab atas kerugian langsung maupun tidak langsung yang timbul dari penggunaan layanan kami, termasuk namun tidak terbatas pada kehilangan data atau gangguan bisnis.'
        },
        {
          title: '6. Hukum yang Berlaku',
          content: 'Syarat dan ketentuan ini diatur oleh hukum yang berlaku di Republik Indonesia.'
        },
        {
          title: '7. Hubungi Kami',
          content: 'Jika Anda memiliki pertanyaan tentang syarat dan ketentuan ini, silakan hubungi kami di support@idcashier.my.id.'
        }
      ]
    },
    en: {
      title: 'Terms & Conditions',
      heading: 'Terms of Service',
      lastUpdated: 'Last updated:',
      sections: [
        {
          title: '1. General Terms',
          content: 'By accessing and using idCashier, you agree to be bound by these terms and conditions. If you do not agree, you are not permitted to use our services.'
        },
        {
          title: '2. Services',
          content: 'idCashier provides cloud-based Point of Sale (POS) system services to help manage your business. We reserve the right to update, modify, or discontinue service features at any time.'
        },
        {
          title: '3. User Accounts',
          list: [
            'You are responsible for maintaining the confidentiality of your account information and password.',
            'You agree to provide accurate and complete information during registration.',
            'Misuse of the account for illegal activities is strictly prohibited.'
          ]
        },
        {
          title: '4. Payment and Subscription',
          list: [
            'idCashier services are available on a subscription model (monthly/yearly).',
            'Payment Gateway: Payments are processed through our official partner, Duitku. By making a payment, you are subject to the terms and conditions applicable at Duitku.',
            'Refunds: Subscription fees paid are non-refundable, unless required by applicable law.'
          ]
        },
        {
          title: '5. Limitation of Liability',
          content: 'idCashier is not liable for any direct or indirect losses arising from the use of our services, including but not limited to data loss or business interruption.'
        },
        {
          title: '6. Governing Law',
          content: 'These terms and conditions are governed by the laws applicable in the Republic of Indonesia.'
        },
        {
          title: '7. Contact Us',
          content: 'If you have any questions about these terms and conditions, please contact us at support@idcashier.my.id.'
        }
      ]
    },
    zh: {
      title: '条款和条件',
      heading: '服务条款',
      lastUpdated: '最后更新:',
      sections: [
        {
          title: '1. 一般条款',
          content: '访问和使用 idCashier 即表示您同意受这些条款和条件的约束。如果您不同意，则不得使用我们的服务。'
        },
        {
          title: '2. 服务',
          content: 'idCashier 提供基于云的销售点 (POS) 系统服务，以帮助管理您的业务。我们保留随时更新、修改或终止服务功能的权利。'
        },
        {
          title: '3. 用户帐户',
          list: [
            '您有责任对您的帐户信息和密码保密。',
            '您同意在注册时提供准确和完整的信息。',
            '严禁滥用帐户进行非法活动。'
          ]
        },
        {
          title: '4. 付款和订阅',
          list: [
            'idCashier 服务采用订阅模式（按月/按年）。',
            '支付网关：付款通过我们的官方合作伙伴 Duitku 处理。付款即表示您受 Duitku 适用条款和条件的约束。',
            '退款：已支付的订阅费用不可退还，除非适用法律要求。'
          ]
        },
        {
          title: '5. 责任限制',
          content: 'idCashier 不对因使用我们的服务而产生的任何直接或间接损失负责，包括但不限于数据丢失或业务中断。'
        },
        {
          title: '6. 适用法律',
          content: '这些条款和条件受印度尼西亚共和国适用法律的管辖。'
        },
        {
          title: '7. 联系我们',
          content: '如果您对这些条款和条件有任何疑问，请通过 support@idcashier.my.id 与我们联系。'
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
