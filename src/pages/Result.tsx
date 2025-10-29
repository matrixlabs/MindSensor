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

  // Calculate statistical data
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

    const duration = samples.length; // seconds
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
          userMessage = 'You cancelled the transaction signature';
        } else if (errorMsg.includes('insufficient funds')) {
          userMessage = 'Insufficient balance, please ensure your account has enough SOL to pay transaction fees';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
          userMessage = 'Transaction confirmation timeout, please check network connection or try again later';
        } else if (errorMsg.includes('blockhash not found')) {
          userMessage = 'Blockhash expired, please try again';
        } else if (errorMsg.includes('failed to confirm')) {
          userMessage = 'Transaction confirmation failed, network may be congested. We have retried multiple times, please try again later';
        } else {
          userMessage = `Blockchain submission failed: ${error.message}`;
        }
      } else {
        userMessage = 'Unknown error, please try again';
      }

      console.log('📝 User-friendly error:', userMessage);
      setSubmissionError(userMessage);
    } finally {
      console.log('🏁 Submission process completed, resetting state');
      setSubmitting(false);
    }
  }, [evaluation, publicKey, sendTransaction, connection, setSubmitting, setSubmissionError, setLastSubmittedRecord]);

  // Chart configuration
  const chartOption: EChartsOption = useMemo(() => {
    return {
      title: {
        text: 'Training Data Overview',
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
          name: 'Relaxation',
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
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (samples.length === 0) {
    return (
      <Layout showBackButton className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <div className="text-gray-500 text-lg">No Data Available</div>
          <Button
            onClick={() => navigate('/monitor')}
            variant="default"
            size="lg"
          >
            <Monitor className="w-4 h-4" />
            Return to Monitoring
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
      {/* Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Training Results</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate('/monitor')}
            variant="default"
            size="default"
          >
            <Monitor className="w-4 h-4" />
            Return to Monitoring
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="secondary"
            size="default"
          >
            <Home className="w-4 h-4" />
            Return to Home
          </Button>
        </div>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Training Duration</div>
          <div className="text-2xl font-bold text-gray-800">{formatDuration(stats.duration)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Average Focus</div>
          <div className="text-2xl font-bold text-blue-600">{stats.avgFocus}</div>
          <div className="text-xs text-gray-500 mt-1">
            Max: {stats.maxFocus} / Min: {stats.minFocus}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Average Relaxation</div>
          <div className="text-2xl font-bold text-green-600">{stats.avgRelax}</div>
          <div className="text-xs text-gray-500 mt-1">
            Max: {stats.maxRelax} / Min: {stats.minRelax}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Data Points</div>
          <div className="text-2xl font-bold text-purple-600">{samples.length}</div>
          <div className="text-xs text-gray-500 mt-1">Approx. 1 data point per second</div>
        </div>
      </div>

      {/* AI Evaluation Card - Only show if evaluation exists */}
      {evaluation && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-md p-6 border-2 border-purple-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">AI Meditation Assessment</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Composite Score</div>
              <div className="text-3xl font-bold text-purple-600">{evaluation.score}</div>
              <div className="text-xs text-gray-500 mt-1">Out of 100</div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Meditation Status</div>
              <div className={`text-xl font-semibold ${evaluation.meditationAchieved ? 'text-green-600' : 'text-orange-600'}`}>
                {evaluation.meditationAchieved ? '✓ Achieved' : '○ Not Achieved'}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Brainwave Characteristics</div>
              <div className="text-xs text-gray-600">
                α Wave Ratio: {evaluation.alphaRatio}%
              </div>
              <div className="text-xs text-gray-600">
                β Wave Ratio: {evaluation.betaRatio}%
              </div>
            </div>
          </div>

          {evaluation.notes && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-600 mb-2">Assessment Recommendations</div>
              <div className="text-gray-800">{evaluation.notes}</div>
            </div>
          )}

          {/* Blockchain Submission Section */}
          <div className="bg-white rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Blockchain Storage
            </h3>

            {!publicKey ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  After connecting wallet, you can permanently store your meditation assessment results on the Solana blockchain
                </p>
                <WalletMultiButton />
              </div>
            ) : lastSubmittedRecord ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div className="ml-2">
                  <div className="font-semibold text-green-800">Successfully submitted to blockchain!</div>
                  <AlertDescription className="text-green-700">
                    <div className="mt-2 space-y-1">
                      <div className="text-sm">Transaction signature: {lastSubmittedRecord.txSignature.slice(0, 16)}...</div>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          View on Solana Explorer
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
                      <div className="font-semibold">Blockchain Submission Failed</div>
                      <AlertDescription>{submissionError}</AlertDescription>
                    </div>
                  </Alert>
                )}

                <p className="text-sm text-gray-600">
                  Store assessment data as tamper-proof records on the Solana blockchain. Your data will be permanently preserved.
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
                        Submitting to Blockchain...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Submit to Blockchain
                      </>
                    )}
                  </Button>

                  {isSubmitting && (
                    <span className="text-sm text-gray-600">
                      Confirming transaction, please wait...
                    </span>
                  )}
                </div>

                <Alert className="border-blue-200 bg-blue-50">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  <AlertDescription className="text-blue-700 text-sm ml-2">
                    Need to pay a small amount of SOL as network fee (approximately 0.00001 SOL)
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <ReactECharts
          option={chartOption}
          style={{ height: '500px', width: '100%' }}
          notMerge={true}
        />
      </div>

      {/* Time information */}
      {recordStartTime && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">
            <div className="flex justify-between py-2 border-b">
              <span>Start Time:</span>
              <span className="font-medium">{dayjs(recordStartTime).format('YYYY-MM-DD HH:mm:ss')}</span>
            </div>
            <div className="flex justify-between py-2">
              <span>End Time:</span>
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
