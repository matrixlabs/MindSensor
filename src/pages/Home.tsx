import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Button } from '../components/ui/button';
import Layout from '../components/Layout';

export default function Home() {
  const navigate = useNavigate();

  return (
    <Layout className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
      <div className="text-center space-y-8 p-8">
        <div>
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            Mindsensor 监测
          </h1>
          <p className="text-xl text-gray-600">
            实时脑电波数据采集与分析
          </p>
        </div>

        <Button
          onClick={() => navigate('/monitor')}
          size="lg"
          className="text-lg px-8 py-6 h-auto"
        >
          <Activity className="w-5 h-5" />
          进入监测页面
        </Button>

        <div className="text-sm text-gray-500 mt-8">
          <p>请确保您的设备支持蓝牙并已开启</p>
          <p>建议使用桌面版 Chrome 浏览器</p>
        </div>
      </div>
    </Layout>
  );
}

