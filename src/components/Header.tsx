import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

interface HeaderProps {
  showBackButton?: boolean;
}

export default function Header({ showBackButton = false }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="w-full border-b border-slate-200 bg-white/50 h-20">
      <div className="w-full max-w-[1400px] mx-auto flex items-center justify-between py-2 px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-orange-400 to-pink-500" />
            <span className="text-xl font-semibold text-black">意念精灵</span>
          </div>
          {showBackButton && (
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="h-12 px-8 border-slate-300 text-slate-500 rounded-lg ml-4"
            >
              返回首页
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

