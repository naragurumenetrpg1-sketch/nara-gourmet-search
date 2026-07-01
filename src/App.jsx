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
    return result.map(cell => cell.replace(/^"|"$/g, ''));
  };

  // Google Sheetsからデータを取得
  const fetchSheetData = async () => {
    try {
      setLoading(true);
      setError("");
      
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=シート1`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const csvText = await response.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('シートにデータがありません');
      }
      
      const header = parseCSVLine(lines[0]);
      const dataLines = lines.slice(1);
      
      const formattedData = dataLines
        .map(line => parseCSVLine(line))
        .filter(row => row && row.length > 0 && row[0]?.trim())
        .map(row => {
          const restaurant = {};
          header.forEach((column, index) => {
            restaurant[column] = row[index] || '';
          });
          
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
      
      setData(formattedData);
      setResults(formattedData);
      
    } catch (err) {
      setError(`データの取得に失敗しました: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheetData();
  }, []);

  const toHiragana = (str) => {
    if (!str) return "";
    return str.replace(/[ァ-ン]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0x60));
  };

  const handleSearch = async () => {
    setShowGenreSuggestions(false);
    setShowLocationSuggestions(false);
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

    const sorted = filtered.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.name.localeCompare(b.name, 'ja');
    });

    setResults(sorted);
    setCurrentPage(1);
    setIsSearching(false);

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
    <div className="absolute z-20 bg-white border border-green-900/20 w-full mt-1 rounded-lg shadow-xl overflow-y-auto max-h-36">
      {suggestions.map((suggestion, idx) => (
        <div
          key={idx}
          className="px-4 py-3 hover:bg-stone-50 cursor-pointer transition-colors duration-200 border-b border-green-900/10 last:border-b-0 text-gray-800"
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800 mx-auto mb-4"></div>
          <p className="text-gray-600">奈良のグルメを一緒に盛り上げよう…！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* ヘッダー */}
      <div
        className="text-white relative overflow-hidden"
        style={{
          backgroundImage: "url('/deer.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
        }}
      >
        <div className="absolute inset-0 bg-green-950/60"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-12 pb-8 sm:pb-10 text-center">
          {/* 隠しガチャアイコン - ヘッダー右上 */}
          <a
            href="https://nara-gourmet-gacha.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            title="グルメガチャ"
            className="absolute top-3 right-3 sm:top-4 sm:right-4"
          >
            <img
              src="data:image/png;base64,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"
              alt="ガチャ"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full opacity-40 hover:opacity-100 transition-opacity duration-300"
            />
          </a>
          <h1
            className="text-3xl sm:text-5xl md:text-6xl font-black mb-2 sm:mb-3 tracking-wide leading-tight"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.7), 0 4px 24px rgba(0,0,0,0.5)" }}
          >
            奈良グルメ検索
            <span
              className="block text-lg sm:text-2xl md:text-3xl font-semibold text-white mt-2"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}
            >SEARCH ENGINE</span>
          </h1>
          <p
            className="text-sm sm:text-lg md:text-xl text-white font-medium mt-3 sm:mt-4"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
          >2つの条件で、理想のお店を見つけよう</p>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-400/30 rounded-lg p-3">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>


      <div className="bg-stone-50 border-b border-green-900/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="bg-white rounded-2xl shadow-lg border border-green-900/10 p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 地名・駅名入力 */}
              <div className="relative">
                <label className="block text-sm sm:text-base font-medium text-gray-700 mb-3">地名・駅名</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-green-900" />
                  <input
                    className="w-full pl-12 pr-4 py-4 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-700 focus:border-green-700 outline-none transition-all duration-300 text-gray-900 placeholder-gray-400"
                    placeholder="奈良市、奈良駅など"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onFocus={() => setShowLocationSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 150)}
                    onKeyDown={(e) => e.key === 'Enter' && setShowLocationSuggestions(false)}
                  />
                </div>
                {showLocationSuggestions && (location ? getSuggestions(location, uniqueLocations) : uniqueLocations).length > 0 && (
                  <SuggestionList suggestions={location ? getSuggestions(location, uniqueLocations) : uniqueLocations} type="location" />
                )}
              </div>

              {/* ジャンル入力 */}
              <div className="relative">
                <label className="block text-sm sm:text-base font-medium text-gray-700 mb-3">ジャンル</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-green-900" />
                  <input
                    className="w-full pl-12 pr-4 py-4 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-700 focus:border-green-700 outline-none transition-all duration-300 text-gray-900 placeholder-gray-400"
                    placeholder="中華、ラーメン、日本料理など"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    onFocus={() => setShowGenreSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowGenreSuggestions(false), 150)}
                    onKeyDown={(e) => e.key === 'Enter' && setShowGenreSuggestions(false)}
                  />
                </div>
                {showGenreSuggestions && (genre ? getSuggestions(genre, uniqueGenres) : uniqueGenres).length > 0 && (
                  <SuggestionList suggestions={genre ? getSuggestions(genre, uniqueGenres) : uniqueGenres} type="genre" />
                )}
              </div>
            </div>

            {/* 検索ボタン */}
            <div className="flex gap-2 sm:gap-4 justify-center">
              <button
                className={`flex-1 px-6 sm:px-12 py-3 sm:py-4 text-sm sm:text-base rounded-lg font-medium transition-all duration-300 ${
                  isSearching ? "bg-green-700/40 cursor-not-allowed" : "bg-green-600 hover:bg-green-900"
                } text-white flex items-center justify-center gap-2`}
                onClick={handleSearch}
                disabled={isSearching}
              >
                <Search className={`h-4 sm:h-5 w-4 sm:w-5 ${isSearching ? "animate-spin" : ""}`} />
                {isSearching ? "検索中..." : "検索する"}
              </button>
              <button
                className="flex-1 px-4 sm:px-8 py-3 sm:py-4 text-sm sm:text-base rounded-lg font-medium border border-green-800/40 hover:bg-stone-50 text-green-900 transition-all duration-300"
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
          <>
            <div className="text-center pt-0 pb-2">
              <button
                onClick={() => setShowInstallGuide(true)}
                className="text-sm text-gray-500 hover:text-green-900 transition-colors duration-200 underline decoration-dotted"
              >
                ホーム画面に追加する方法
              </button>
            </div>

            {/* LINEオープンチャットバナー */}
            <div className="max-w-sm mx-auto mt-2 mb-8">
              <a
                href="https://line.me/ti/g2/pNECGVb3UjM_CieROz7Ca0vDb_Fq9YFK3FK7OQ?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white border border-green-900/20 rounded-xl hover:shadow-md transition-all duration-300 group"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-green-700 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 mb-0.5">奈良グルメ掲示板の</p>
                  <p className="text-sm font-bold text-gray-900 group-hover:text-green-900 transition-colors duration-300">
                    参加はこちら →
                  </p>
                </div>
              </a>
            </div>
          </>
        ) : results.length > 0 ? (
          <>
            <div className="mb-8 sm:mb-12 text-center">
              <h2 className="text-2xl sm:text-3xl font-light text-green-900 mb-2">検索結果</h2>
              <div className="w-16 h-px bg-stone-500 mx-auto mb-4"></div>
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
                  className={`group bg-white border border-green-900/10 rounded-lg overflow-hidden transition-all duration-500 hover:-translate-y-1 block ${
                    store.link ? 'hover:shadow-xl hover:border-green-800/40 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <h3 className="text-base sm:text-lg md:text-xl font-medium text-gray-900 group-hover:text-green-900 transition-colors duration-300">
                        {store.name}
                      </h3>
                      <span className="text-xs font-medium text-green-900 bg-stone-50 px-2 py-1 rounded whitespace-nowrap ml-2">
                        {store.genre}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-500 mb-3 sm:mb-4">
                      <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-green-900" />
                      <span className="text-xs sm:text-sm">
                        {store.location}
                        {store.station && <span className="ml-1">/ {store.station}</span>}
                        {store.station2 && <span className="ml-1">/ {store.station2}</span>}
                      </span>
                    </div>

                    {store.link && (
                      <div className="inline-flex items-center gap-2 text-green-900 group-hover:text-green-900 font-medium transition-colors duration-300 text-xs sm:text-sm">
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
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      currentPage === 1
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-white border border-green-800/40 text-green-900 hover:bg-stone-50"
                    }`}
                  >
                    前へ
                  </button>

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
                            ? "bg-green-800 text-white"
                            : "bg-white border border-green-800/40 text-green-900 hover:bg-stone-50"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      currentPage === totalPages
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-white border border-green-800/40 text-green-900 hover:bg-stone-50"
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
            <h3 className="text-2xl font-light text-green-900 mb-4">該当する店舗が見つかりませんでした</h3>
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
                className="text-gray-400 hover:text-green-900 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              <div className="border-b border-green-900/10 pb-6">
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

            <div className="mt-6 pt-6 border-t border-green-900/10 text-center">
              <button
                onClick={() => setShowInstallGuide(false)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-900 transition-colors duration-200"
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