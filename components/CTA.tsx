import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '@/data/mockData';

interface WhatsAppButtonProps {
  text?: string;
  className?: string;
  fixed?: boolean;
}

export function WhatsAppButton({ text = 'Chat on WhatsApp', className = '', fixed = false }: WhatsAppButtonProps) {
  const baseClasses = 'inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20BA5A] text-white px-6 py-3 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl';
  const fixedClasses = fixed ? 'fixed bottom-6 right-6 z-50 animate-pulse' : '';
  
  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClasses} ${fixedClasses} ${className}`}
    >
      <MessageCircle className="w-5 h-5" />
      <span>{text}</span>
    </a>
  );
}
