import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { useMonitorStore } from '../store/monitorStore';

dayjs.extend(duration);

export default function Result() {
  const navigate = useNavigate();
  const { samples, recordStartTime, series } = useMonitorStore();

  // 计算统计数据
  const stats = useMemo(() => {
    if (samples.length === 0) {
      return {
        duration: 0,
        avgFocus: 0,
        avgRelax: 0,
        maxFocus: 0,
        maxRelax: 0,
        minFocus: 0,
        minRelax: 0,
      };
    }

    const focusValues = samples.map(s => s.focus);
    const relaxValues = samples.map(s => s.relax);

    const duration = samples.length; // 秒数
    const avgFocus = Math.round(focusValues.reduce((a, b) => a + b, 0) / focusValues.length);
    const avgRelax = Math.round(relaxValues.reduce((a, b) => a + b, 0) / relaxValues.length);
    const maxFocus = Math.max(...focusValues);
    const maxRelax = Math.max(...relaxValues);
    const minFocus = Math.min(...focusValues);
    const minRelax = Math.min(...relaxValues);

    return { duration, avgFocus, avgRelax, maxFocus, maxRelax, minFocus, minRelax };
  }, [samples]);

  // 图表配置
  const chartOption: EChartsOption = useMemo(() => {
    return {
      title: {
        text: '训练数据总览',
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const time = dayjs(params[0].value[0]).format('HH:mm:ss');
          let html = `<div><strong>${time}</strong></div>`;
          params.forEach((param: any) => {
            html += `<div>${param.marker} ${param.seriesName}: ${param.value[1]}</div>`;
          });
          return html;
        },
      },
      legend: {
        data: ['专注度', '放松度'],
        top: 30,
      },
      grid: {
        top: 80,
        left: 60,
        right: 40,
        bottom: 60,
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLabel: {
          formatter: (value: number) => dayjs(value).format('HH:mm:ss'),
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#eee',
          },
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}',
        },
        splitLine: {
          lineStyle: {
            color: '#eee',
          },
        },
      },
      series: [
        {
          name: '专注度',
          type: 'line',
          showSymbol: false,
          data: samples.map(s => [s.t, s.focus]),
          lineStyle: {
            width: 2,
            color: '#3b82f6',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
              ],
            },
          },
        },
        {
          name: '放松度',
          type: 'line',
          showSymbol: false,
          data: samples.map(s => [s.t, s.relax]),
          lineStyle: {
            width: 2,
            color: '#10b981',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  }, [samples]);

  const formatDuration = (seconds: number) => {
    const dur = dayjs.duration(seconds, 'seconds');
    const hours = Math.floor(dur.asHours());
    const minutes = dur.minutes();
    const secs = dur.seconds();
    
    if (hours > 0) {
      return `${hours}小时${minutes}分${secs}秒`;
    } else if (minutes > 0) {
      return `${minutes}分${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  };

  if (samples.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-gray-500 text-lg">暂无数据</div>
          <button
            onClick={() => navigate('/monitor')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回监测
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">训练结果</h1>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/monitor')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              返回监测
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-2">训练时长</div>
            <div className="text-2xl font-bold text-gray-800">{formatDuration(stats.duration)}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-2">平均专注度</div>
            <div className="text-2xl font-bold text-blue-600">{stats.avgFocus}</div>
            <div className="text-xs text-gray-500 mt-1">
              最高: {stats.maxFocus} / 最低: {stats.minFocus}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-2">平均放松度</div>
            <div className="text-2xl font-bold text-green-600">{stats.avgRelax}</div>
            <div className="text-xs text-gray-500 mt-1">
              最高: {stats.maxRelax} / 最低: {stats.minRelax}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-2">数据点数</div>
            <div className="text-2xl font-bold text-purple-600">{samples.length}</div>
            <div className="text-xs text-gray-500 mt-1">约每秒 1 个数据点</div>
          </div>
        </div>

        {/* 图表 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <ReactECharts
            option={chartOption}
            style={{ height: '500px', width: '100%' }}
            notMerge={true}
          />
        </div>

        {/* 时间信息 */}
        {recordStartTime && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600">
              <div className="flex justify-between py-2 border-b">
                <span>开始时间:</span>
                <span className="font-medium">{dayjs(recordStartTime).format('YYYY-MM-DD HH:mm:ss')}</span>
              </div>
              <div className="flex justify-between py-2">
                <span>结束时间:</span>
                <span className="font-medium">
                  {dayjs(recordStartTime + stats.duration * 1000).format('YYYY-MM-DD HH:mm:ss')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

