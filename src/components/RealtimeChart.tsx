import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs from 'dayjs';
import { useMonitorStore } from '../store/monitorStore';

export default function RealtimeChart() {
  const { samples, recordStartTime } = useMonitorStore();

  const option: EChartsOption = useMemo(() => {
    return {
      animation: false,
      title: {
        text: 'Real-time EEG Data',
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
        data: ['Focus', 'Relaxation'],
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
        boundaryGap: [0, 0],
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
          name: 'Focus',
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
          name: 'Relaxation',
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {samples.length === 0 ? (
        <div className="h-96 flex items-center justify-center text-gray-500">
          {recordStartTime ? 'Waiting for data...' : 'Click "Start" button to begin recording data'}
        </div>
      ) : (
        <ReactECharts
          option={option}
          style={{ height: '400px', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
        />
      )}
    </div>
  );
}

