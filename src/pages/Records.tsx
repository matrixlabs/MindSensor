import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Home, RefreshCw, Trash2, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import Layout from '../components/Layout';
import { fetchMeditationInscriptions } from '../services/helius';
import { getCachedRecords, clearCachedRecords, mergeRecords, setCachedRecords } from '../services/storage';
import { detectNetwork, getExplorerUrl, getNetworkDisplayName } from '../utils/network';
import type { MeditationRecord } from '../types/meditation';

export default function Records() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const network = detectNetwork(connection);
  const networkName = getNetworkDisplayName(network);

  // Fetch on-chain records
  const { data: onChainRecords = [], isLoading, error, refetch } = useQuery({
    queryKey: ['meditationRecords', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return [];
      console.log('📡 Fetching meditation inscriptions from chain...');
      const records = await fetchMeditationInscriptions({
        address: publicKey.toBase58(),
        limit: 50,
      });
      console.log(`📊 Retrieved ${records.length} records from chain`);
      return records;
    },
    enabled: !!publicKey,
    refetchInterval: false,
    staleTime: 30000, // 30 seconds (but can be bypassed by manual refetch)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Get cached records
  const cachedRecords = getCachedRecords();

  // Merge on-chain and cached records
  const allRecords: MeditationRecord[] = publicKey
    ? mergeRecords(onChainRecords, cachedRecords)
    : cachedRecords;

  const handleClearCache = useCallback(() => {
    setIsClearing(true);
    try {
      clearCachedRecords();
      // Refetch to update UI
      setTimeout(() => {
        setIsClearing(false);
        if (publicKey) {
          refetch();
        }
      }, 500);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      setIsClearing(false);
    }
  }, [publicKey, refetch]);

  const handleRefresh = useCallback(async () => {
    if (!publicKey) {
      return;
    }

    console.log('🔄 Refreshing on-chain records...');
    setIsRefreshing(true);

    try {
      // Force refetch from blockchain, ignoring cache
      const result = await refetch();

      if (result.data) {
        console.log(`✅ Fetched ${result.data.length} records from chain`);

        // Update local cache with fresh on-chain data
        // Keep only confirmed records in cache
        const confirmedRecords = result.data.filter(r => r.status === 'confirmed');
        setCachedRecords(confirmedRecords);

        console.log(`💾 Updated cache with ${confirmedRecords.length} confirmed records`);
      }
    } catch (error) {
      console.error('❌ Failed to refresh records:', error);
    } finally {
      setIsRefreshing(false);
      console.log('🏁 Refresh complete');
    }
  }, [publicKey, refetch]);

  const getStatusBadge = (status: MeditationRecord['status']) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
            <CheckCircle className="w-3 h-3" />
            已确认
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded-full">
            <Clock className="w-3 h-3" />
            待确认
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full">
            <XCircle className="w-3 h-3" />
            失败
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Layout showBackButton className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">训练记录</h1>
          <p className="text-gray-600 mt-1">查看您的链上冥想训练历史</p>
        </div>
        <Button
          onClick={() => navigate('/')}
          variant="secondary"
          size="default"
        >
          <Home className="w-4 h-4" />
          返回首页
        </Button>
      </div>

      {/* Network Info & Actions */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-gray-600">当前网络</div>
              <div className="text-lg font-semibold text-purple-600">{networkName}</div>
            </div>
            {publicKey && (
              <div>
                <div className="text-sm text-gray-600">钱包地址</div>
                <div className="text-sm font-mono text-gray-800">
                  {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!publicKey ? (
              <WalletMultiButton />
            ) : (
              <>
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing || isLoading}
                  variant="secondary"
                  size="sm"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? '刷新中...' : '刷新'}
                </Button>
                <Button
                  onClick={handleClearCache}
                  disabled={isClearing}
                  variant="secondary"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                  清空缓存
                </Button>
                <WalletMultiButton />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-5 w-5" />
          <div className="ml-2">
            <div className="font-semibold">加载失败</div>
            <AlertDescription>
              {error instanceof Error ? error.message : '无法加载链上记录'}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && publicKey && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-600">加载链上记录中...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && allRecords.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="text-gray-400 text-lg">暂无训练记录</div>
            {!publicKey && (
              <p className="text-gray-600">连接钱包以查看您的链上记录</p>
            )}
          </div>
        </div>
      )}

      {/* Records Grid */}
      {allRecords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allRecords.map((record) => {
            const explorerUrl = getExplorerUrl(record.txSignature, network);
            const timestamp = record.blockTime
              ? dayjs.unix(record.blockTime).format('YYYY-MM-DD HH:mm:ss')
              : record.timestamp
              ? dayjs.unix(record.timestamp).format('YYYY-MM-DD HH:mm:ss')
              : '未知时间';

            return (
              <div
                key={record.txSignature}
                className="bg-white rounded-lg shadow-md p-5 border-l-4 border-purple-500 hover:shadow-lg transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">评分</div>
                    <div className="text-3xl font-bold text-purple-600">{record.score}</div>
                  </div>
                  {getStatusBadge(record.status)}
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">时长</span>
                    <span className="font-medium">{Math.floor(record.durationSec / 60)}分{record.durationSec % 60}秒</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">状态</span>
                    <span className={`font-medium ${record.meditationAchieved ? 'text-green-600' : 'text-orange-600'}`}>
                      {record.meditationAchieved ? '已达成' : '未达成'}
                    </span>
                  </div>

                  {record.avgFocus !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">平均专注度</span>
                      <span className="font-medium text-blue-600">{record.avgFocus}</span>
                    </div>
                  )}

                  {record.avgRelax !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">平均放松度</span>
                      <span className="font-medium text-green-600">{record.avgRelax}</span>
                    </div>
                  )}

                  {record.alphaRatio !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">α波比例</span>
                      <span className="font-medium">{record.alphaRatio}%</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {record.notes && (
                  <div className="mb-3 p-2 bg-gray-50 rounded text-xs text-gray-700">
                    {record.notes}
                  </div>
                )}

                {/* Footer */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-2">{timestamp}</div>
                  {record.status === 'confirmed' && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      在 Explorer 查看
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {record.status === 'pending' && (
                    <div className="text-xs text-yellow-600">
                      交易待确认...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      {allRecords.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-md p-6 border border-purple-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">统计概览</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">总记录数</div>
              <div className="text-2xl font-bold text-purple-600">{allRecords.length}</div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">平均评分</div>
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(allRecords.reduce((sum, r) => sum + r.score, 0) / allRecords.length)}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">已达成次数</div>
              <div className="text-2xl font-bold text-green-600">
                {allRecords.filter(r => r.meditationAchieved).length}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">总时长</div>
              <div className="text-2xl font-bold text-orange-600">
                {Math.floor(allRecords.reduce((sum, r) => sum + r.durationSec, 0) / 60)}分
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
