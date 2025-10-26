import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-8 p-8">
        <div>
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            Mindsensor 监测
          </h1>
          <p className="text-xl text-gray-600">
            实时脑电波数据采集与分析
          </p>
        </div>

        <button
          onClick={() => navigate('/monitor')}
          className="px-8 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-lg shadow-lg hover:bg-indigo-700 transition-colors duration-200"
        >
          进入监测页面
        </button>

        <div className="text-sm text-gray-500 mt-8">
          <p>请确保您的设备支持蓝牙并已开启</p>
          <p>建议使用桌面版 Chrome 浏览器</p>
        </div>
      </div>
    </div>
  );
}

