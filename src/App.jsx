import React, { useState, useEffect } from "react";
import { Search, MapPin, ExternalLink } from "lucide-react";

// Google Sheets設定
const SHEET_ID = '19O0ge4LPff4dkPomR3tWJvH6C7zCufwQDmRa7djrkUI';

export default function GourmetSearch() {
  const [location, setLocation] = useState("");
  const [genre, setGenre] = useState("");
  const [results, setResults] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showGenreSuggestions, setShowGenreSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // CSVを解析する関数
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(cell => cell.replace(/^"|"$/g, '')); // クォートを削除
  };

  // Google Sheetsからデータを取得
  const fetchSheetData = async () => {
    try {
      setLoading(true);
      setError("");
      
      console.log('Googleシートからデータ取得開始...');
      
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=シート1`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const csvText = await response.text();
      console.log('CSV取得成功');
      
      // CSVを解析
      const lines = csvText.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('シートにデータがありません');
      }
      
      // ヘッダー行とデータ行を分離
      const header = parseCSVLine(lines[0]);
      console.log('ヘッダー行:', header);
      
      const dataLines = lines.slice(1);
      
      // データを整形
      const formattedData = dataLines
        .map(line => parseCSVLine(line))
        .filter(row => row && row.length > 0 && row[0]?.trim())
        .map(row => {
          const restaurant = {};
          header.forEach((column, index) => {
            restaurant[column] = row[index] || '';
          });
          
          // データ構造を統一
          const genre1 = restaurant['ジャンル'] || restaurant['genre1'] || '';
          const genre2 = restaurant['ジャンル2'] || restaurant['genre2'] || '';
          const combinedGenre = genre2 ? `${genre1}, ${genre2}` : genre1;
          
          return {
            name: restaurant['店名'] || restaurant['name(店名)'] || '',
            genre: combinedGenre,
            link: restaurant['マップ'] || restaurant['link(Gmap)'] || '',
            location: restaurant['地名'] || restaurant['location(市)'] || '',
            station: restaurant['駅名'] || restaurant['station1(駅)'] || '',
            station2: restaurant['駅名2'] || restaurant['station2(駅)'] || '',
            image: restaurant['画像'] || restaurant['image(画像)'] || '',
            latitude: restaurant['緯度'] || restaurant['lat(緯度)'] || '',
            longitude: restaurant['経度'] || restaurant['lng(軽度)'] || '',
            priority: parseInt(restaurant['優先度'] || restaurant['priority'] || '0') || 0
          };
        })
        .filter(item => item.name.trim());
      
      console.log(`${formattedData.length}件のデータを取得しました`);
      
      setData(formattedData);
      setResults(formattedData);
      
    } catch (err) {
      console.error('データ取得エラー:', err);
      setError(`データの取得に失敗しました: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 初回データ取得
  useEffect(() => {
    fetchSheetData();
  }, []);

  const toHiragana = (str) => {
    if (!str) return "";
    return str.replace(/[ァ-ン]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0x60));
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setHasSearched(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    const filtered = data.filter((store) => {
      const matchLocation =
        toHiragana(store.location).includes(toHiragana(location)) ||
        toHiragana(store.station).includes(toHiragana(location)) ||
        toHiragana(store.station2).includes(toHiragana(location)) ||
        !location.trim();

      const matchGenre =
        toHiragana(store.genre).includes(toHiragana(genre)) || !genre.trim();

      return matchLocation && matchGenre;
    });

    // 優先度でソート（高い順）→ 店名で50音順
    const sorted = filtered.sort((a, b) => {
      // 優先度が異なる場合は優先度順
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // 優先度が同じ場合は店名の50音順
      return a.name.localeCompare(b.name, 'ja');
    });

    setResults(sorted);
    setCurrentPage(1);
    setIsSearching(false);

    // 検索結果にスクロール
    setTimeout(() => {
      const resultsElement = document.querySelector('#search-results');
      if (resultsElement) {
        resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const uniqueLocations = [
    ...new Set([...data.map((store) => store.location), ...data.map((store) => store.station), ...data.map((store) => store.station2)]),
  ].filter(Boolean);

  const uniqueGenres = [...new Set(data.flatMap(store => store.genre.split(',').map(g => g.trim())))].filter(Boolean);

  const getSuggestions = (input, list) => {
    if (!input) return [];
    return list.filter((item) => toHiragana(item).includes(toHiragana(input))).slice(0, 5);
  };

  const clearSearch = () => {
    setLocation("");
    setGenre("");
    setResults([]);
    setHasSearched(false);
    setCurrentPage(1);
  };

  const handleSuggestionClick = (value, type) => {
    if (type === "location") {
      setLocation(value);
      setShowLocationSuggestions(false);
    } else {
      setGenre(value);
      setShowGenreSuggestions(false);
    }
  };

  const SuggestionList = ({ suggestions, type }) => (
    <div className="absolute z-20 bg-white border border-gray-200 w-full mt-1 rounded-lg shadow-xl overflow-hidden">
      {suggestions.map((suggestion, idx) => (
        <div
          key={idx}
          className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors duration-200 border-b border-gray-100 last:border-b-0 text-gray-800"
          onClick={() => handleSuggestionClick(suggestion, type)}
        >
          {suggestion}
        </div>
      ))}
    </div>
  );

  // ページネーション
  const totalPages = Math.ceil(results.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResults = results.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(page);
    const resultsElement = document.querySelector('#search-results');
    if (resultsElement) {
      resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ローディング画面
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Googleシートからデータを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* ヘッダー */}
      <div className="bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-12 pb-8 sm:pb-10 text-center">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-light mb-2 sm:mb-3 tracking-tight leading-tight">
            奈良グルメ検索
            <span className="block text-lg sm:text-2xl md:text-3xl font-thin text-gray-300 mt-2">SEARCH ENGINE</span>
          </h1>
          <p className="text-sm sm:text-lg md:text-xl text-gray-300 font-light mt-3 sm:mt-4">2つの条件で、理想のお店を見つけよう</p>

          {/* エラー表示 */}
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* 検索エリア */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 地名・駅名入力 */}
              <div className="relative">
                <label className="block text-sm sm:text-base font-medium text-gray-700 mb-3">地名・駅名</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    className="w-full pl-12 pr-4 py-4 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all duration-300 text-gray-900 placeholder-gray-400"
                    placeholder="奈良市、奈良駅など"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onFocus={() => setShowLocationSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                  />
                </div>
                {showLocationSuggestions && getSuggestions(location, uniqueLocations).length > 0 && (
                  <SuggestionList suggestions={getSuggestions(location, uniqueLocations)} type="location" />
                )}
              </div>

              {/* ジャンル入力 */}
              <div className="relative">
                <label className="block text-sm sm:text-base font-medium text-gray-700 mb-3">ジャンル</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    className="w-full pl-12 pr-4 py-4 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all duration-300 text-gray-900 placeholder-gray-400"
                    placeholder="中華、ラーメン、日本料理など"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    onFocus={() => setShowGenreSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowGenreSuggestions(false), 200)}
                  />
                </div>
                {showGenreSuggestions && getSuggestions(genre, uniqueGenres).length > 0 && (
                  <SuggestionList suggestions={getSuggestions(genre, uniqueGenres)} type="genre" />
                )}
              </div>
            </div>

            {/* 検索ボタン */}
            <div className="flex gap-2 sm:gap-4 justify-center">
              <button
                className={`flex-1 px-6 sm:px-12 py-3 sm:py-4 text-sm sm:text-base rounded-lg font-medium transition-all duration-300 ${
                  isSearching ? "bg-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-800"
                } text-white flex items-center justify-center gap-2`}
                onClick={handleSearch}
                disabled={isSearching}
              >
                <Search className={`h-4 sm:h-5 w-4 sm:w-5 ${isSearching ? "animate-spin" : ""}`} />
                {isSearching ? "検索中..." : "検索する"}
              </button>
              <button
                className="flex-1 px-4 sm:px-8 py-3 sm:py-4 text-sm sm:text-base rounded-lg font-medium border border-gray-300 hover:bg-gray-50 text-gray-700 transition-all duration-300"
                onClick={clearSearch}
              >
                クリア
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 検索結果 */}
      <div id="search-results" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {!hasSearched ? (
          <div className="text-center py-12">
            <button
              onClick={() => setShowInstallGuide(true)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 underline decoration-dotted"
            >
              ホーム画面に追加する方法
            </button>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="mb-8 sm:mb-12 text-center">
              <h2 className="text-2xl sm:text-3xl font-light text-black mb-2">検索結果</h2>
              <div className="w-16 h-px bg-black mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-gray-600">
                {results.length}件の店舗が見つかりました
                {totalPages > 1 && (
                  <span className="ml-2 text-xs sm:text-sm">
                    ({currentPage}/{totalPages}ページ目 - 現在{currentResults.length}件表示)
                  </span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              {currentResults.map((store, idx) => (
                <a
                  key={startIndex + idx}
                  href={store.link || '#'}
                  target={store.link ? "_blank" : "_self"}
                  rel={store.link ? "noopener noreferrer" : undefined}
                  className={`group bg-white border border-gray-200 rounded-lg overflow-hidden transition-all duration-500 hover:-translate-y-1 block ${
                    store.link ? 'hover:shadow-xl cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <h3 className="text-base sm:text-lg md:text-xl font-medium text-black group-hover:text-gray-700 transition-colors duration-300">
                        {store.name}
                      </h3>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded whitespace-nowrap ml-2">
                        {store.genre}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600 mb-3 sm:mb-4">
                      <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">
                        {store.location}
                        {store.station && <span className="ml-1">/ {store.station}</span>}
                        {store.station2 && <span className="ml-1">/ {store.station2}</span>}
                      </span>
                    </div>

                    {store.link && (
                      <div className="inline-flex items-center gap-2 text-black group-hover:text-gray-600 font-medium transition-colors duration-300 text-xs sm:text-sm">
                        <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                        地図で見る
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="mt-16">
                <div className="flex justify-center items-center gap-2">
                  {/* 前のページボタン */}
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      currentPage === 1
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    前へ
                  </button>

                  {/* ページ番号 */}
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let page;
                    if (totalPages <= 7) {
                      page = i + 1;
                    } else if (currentPage <= 4) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      page = totalPages - 6 + i;
                    } else {
                      page = currentPage - 3 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                          currentPage === page
                            ? "bg-black text-white"
                            : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}

                  {/* 次のページボタン */}
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      currentPage === totalPages
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🔍</div>
            <h3 className="text-2xl font-light text-black mb-4">該当する店舗が見つかりませんでした</h3>
            <p className="text-gray-600">検索条件を変更してもう一度お試しください</p>
          </div>
        )}
      </div>

      {/* インストールガイドモーダル */}
      {showInstallGuide && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowInstallGuide(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">📱 ホーム画面に追加</h3>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* iPhone/iPad */}
              <div className="border-b pb-6">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-lg">🍎</span>
                  iPhone / iPad（Safari）
                </h4>
                <ol className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="font-bold min-w-[20px]">1.</span>
                    <span>画面下の<strong>共有ボタン</strong>（□に↑）をタップ</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold min-w-[20px]">2.</span>
                    <span><strong>「ホーム画面に追加」</strong>を選択</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold min-w-[20px]">3.</span>
                    <span>右上の<strong>「追加」</strong>をタップ</span>
                  </li>
                </ol>
              </div>

              {/* Android */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  Android（Chrome）
                </h4>
                <ol className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="font-bold min-w-[20px]">1.</span>
                    <span>画面右上の<strong>メニュー</strong>（⋮）をタップ</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold min-w-[20px]">2.</span>
                    <span><strong>「ホーム画面に追加」</strong>を選択</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold min-w-[20px]">3.</span>
                    <span><strong>「追加」</strong>をタップ</span>
                  </li>
                </ol>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t text-center">
              <button
                onClick={() => setShowInstallGuide(false)}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors duration-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}