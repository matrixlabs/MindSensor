import { useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { Home, Monitor, Upload, ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useMonitorStore } from '../store/monitorStore';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import Layout from '../components/Layout';
import { evaluateEEGSession } from '../utils/eegScoring';
import { submitMeditationInscription } from '../services/inscription';
import { appendRecord } from '../services/storage';
import { detectNetwork, getExplorerUrl } from '../utils/network';

dayjs.extend(duration);

export default function Result() {
  const navigate = useNavigate();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const {
    samples,
    series,
    recordStartTime,
    connected,
    evaluation,
    isSubmitting,
    submissionError,
    lastSubmittedRecord,
    setEvaluation,
    setSubmitting,
    setSubmissionError,
    setLastSubmittedRecord,
  } = useMonitorStore();

  // Generate evaluation when component mounts (if not already generated)
  useEffect(() => {
    if (samples.length > 0 && !evaluation && connected) {
      const durationSec = Math.floor(samples.length); // Approximately 1 sample per second
      const deviceId = connected.name || connected.id;

      const newEvaluation = evaluateEEGSession({
        durationSec,
        deviceId,
        samples,
        series,
      });

      setEvaluation(newEvaluation);
    }
  }, [samples, series, connected, evaluation, setEvaluation]);

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

  // Handle blockchain submission
  const handleSubmitToBlockchain = useCallback(async () => {
    if (!evaluation || !publicKey || !sendTransaction) {
      return;
    }

    console.log('🚀 Starting blockchain submission...');
    setSubmitting(true);
    setSubmissionError(null);

    try {
      const record = await submitMeditationInscription({
        evaluation,
        publicKey,
        connection,
        wallet: { sendTransaction },
      });

      setLastSubmittedRecord(record);
      appendRecord(record);

      console.log('✅ Successfully submitted to blockchain:', record);
    } catch (error) {
      console.error('❌ Blockchain submission failed:', error);

      // Extract user-friendly error message
      let userMessage = '';
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        if (errorMsg.includes('user rejected') || errorMsg.includes('declined') || errorMsg.includes('cancelled')) {
          userMessage = '您取消了交易签名';
        } else if (errorMsg.includes('insufficient funds')) {
          userMessage = '余额不足，请确保账户有足够的 SOL 支付交易费用';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
          userMessage = '交易确认超时，请检查网络连接或稍后重试';
        } else if (errorMsg.includes('blockhash not found')) {
          userMessage = '区块哈希过期，请重试';
        } else if (errorMsg.includes('failed to confirm')) {
          userMessage = '交易确认失败，网络可能拥堵。已尝试多次重试，请稍后再试';
        } else {
          userMessage = `上链失败: ${error.message}`;
        }
      } else {
        userMessage = '未知错误，请重试';
      }

      console.log('📝 User-friendly error:', userMessage);
      setSubmissionError(userMessage);
    } finally {
      console.log('🏁 Submission process completed, resetting state');
      setSubmitting(false);
    }
  }, [evaluation, publicKey, sendTransaction, connection, setSubmitting, setSubmissionError, setLastSubmittedRecord]);

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
          name: '专注度',
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#fff', borderColor: '#3b82f6', borderWidth: 2 },
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
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#fff', borderColor: '#10b981', borderWidth: 2 },
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
      <Layout showBackButton className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <div className="text-gray-500 text-lg">暂无数据</div>
          <Button
            onClick={() => navigate('/monitor')}
            variant="default"
            size="lg"
          >
            <Monitor className="w-4 h-4" />
            返回监测
          </Button>
        </div>
      </Layout>
    );
  }

  const network = detectNetwork(connection);
  const explorerUrl = lastSubmittedRecord
    ? getExplorerUrl(lastSubmittedRecord.txSignature, network)
    : null;

  return (
    <Layout showBackButton className="p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">训练结果</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate('/monitor')}
            variant="default"
            size="default"
          >
            <Monitor className="w-4 h-4" />
            返回监测
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="secondary"
            size="default"
          >
            <Home className="w-4 h-4" />
            返回首页
          </Button>
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

      {/* AI Evaluation Card - Only show if evaluation exists */}
      {evaluation && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-md p-6 border-2 border-purple-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">AI 冥想评估</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">综合评分</div>
              <div className="text-3xl font-bold text-purple-600">{evaluation.score}</div>
              <div className="text-xs text-gray-500 mt-1">满分 100</div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">冥想状态</div>
              <div className={`text-xl font-semibold ${evaluation.meditationAchieved ? 'text-green-600' : 'text-orange-600'}`}>
                {evaluation.meditationAchieved ? '✓ 已达成' : '○ 未达成'}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">脑波特征</div>
              <div className="text-xs text-gray-600">
                α波比例: {evaluation.alphaRatio}%
              </div>
              <div className="text-xs text-gray-600">
                β波比例: {evaluation.betaRatio}%
              </div>
            </div>
          </div>

          {evaluation.notes && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-600 mb-2">评估建议</div>
              <div className="text-gray-800">{evaluation.notes}</div>
            </div>
          )}

          {/* Blockchain Submission Section */}
          <div className="bg-white rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              上链存储
            </h3>

            {!publicKey ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  连接钱包后，可将您的冥想评估结果永久存储在 Solana 区块链上
                </p>
                <WalletMultiButton />
              </div>
            ) : lastSubmittedRecord ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div className="ml-2">
                  <div className="font-semibold text-green-800">已成功上链！</div>
                  <AlertDescription className="text-green-700">
                    <div className="mt-2 space-y-1">
                      <div className="text-sm">交易签名: {lastSubmittedRecord.txSignature.slice(0, 16)}...</div>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          在 Solana Explorer 查看
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </AlertDescription>
                </div>
              </Alert>
            ) : (
              <div className="space-y-3">
                {submissionError && (
                  <Alert variant="destructive">
                    <XCircle className="h-5 w-5" />
                    <div className="ml-2">
                      <div className="font-semibold">上链失败</div>
                      <AlertDescription>{submissionError}</AlertDescription>
                    </div>
                  </Alert>
                )}

                <p className="text-sm text-gray-600">
                  将评估数据作为不可篡改的记录存储在 Solana 区块链上。您的数据将被永久保存。
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSubmitToBlockchain}
                    disabled={isSubmitting}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        上链中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        提交到区块链
                      </>
                    )}
                  </Button>

                  {isSubmitting && (
                    <span className="text-sm text-gray-600">
                      正在确认交易，请稍候...
                    </span>
                  )}
                </div>

                <Alert className="border-blue-200 bg-blue-50">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  <AlertDescription className="text-blue-700 text-sm ml-2">
                    需要支付少量 SOL 作为网络费用（约 0.00001 SOL）
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </div>
      )}

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
    </Layout>
  );
}
