import { useState, useEffect } from 'react';
import { FiLayers, FiLoader, FiCheck, FiAlertTriangle, FiRotateCw } from 'react-icons/fi'; // Add FiRotateCw
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

// Accept props from Tools.jsx
const FlashcardGenerator = ({ onSubmit, result, loading, error }) => {
  const [topicInput, setTopicInput] = useState(''); // Separate state for input field
  const [deckData, setDeckData] = useState(null); // Store the whole deck object {deck_id, topic, cards}
  // Internal error state for component-specific errors
  const [localError, setLocalError] = useState(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0); // Keep for display logic
  const [showAnswer, setShowAnswer] = useState(false); // Keep for display logic
  const { token } = useAuth(); // Get token

  // Helper function to validate and set deck data from the result prop
  const processResult = (data) => {
    console.log("Processing flashcard data:", data);
    
    try {
      // Try to parse if it's a string
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (parsedData && parsedData.error) {
        setLocalError(parsedData.error);
        setDeckData(null);
        return;
      }
      
      if (parsedData && parsedData.cards && Array.isArray(parsedData.cards)) {
        setDeckData(parsedData);
        setActiveCardIndex(0);
        setShowAnswer(false);
        setLocalError(null); // Clear previous errors on new data
        console.log("Successfully set flashcard data:", parsedData);
      } else {
        setLocalError("Received invalid flashcard data format.");
        setDeckData(null);
        console.error("Invalid flashcard data format:", parsedData);
      }
    } catch (err) {
      console.error("Error processing flashcard data:", err);
      setLocalError("Có lỗi khi xử lý dữ liệu flashcard: " + err.message);
      setDeckData(null);
    }
  };

  // Process the result prop when it changes
  useEffect(() => {
    if (result) {
      console.log('FlashcardGenerator received result:', result);
      processResult(result); // Process the result from parent
    } else {
      // Don't clear deck if result becomes null/undefined when switching tabs
      if (loading) {
        // Only clear when loading is true (new request started)
        setDeckData(null);
        setActiveCardIndex(0);
        setShowAnswer(false);
      }
    }
  }, [result, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topicInput.trim() || !token) {
      return;
    }
    
    // Call the onSubmit function passed from Tools.jsx
    onSubmit(topicInput);
    
    // Clear previous deck immediately when submitting a new request
    setDeckData(null);
    setActiveCardIndex(0);
    setShowAnswer(false);
    setLocalError(null);
  };

  // Display current cards or empty array
  const currentCards = deckData?.cards || [];

  const nextCard = () => {
    if (currentCards.length > 0 && activeCardIndex < currentCards.length - 1) {
      setActiveCardIndex(activeCardIndex + 1);
      setShowAnswer(false);
    }
  };

  const prevCard = () => {
    if (currentCards.length > 0 && activeCardIndex > 0) {
      setActiveCardIndex(activeCardIndex - 1);
      setShowAnswer(false);
    }
  };

  const toggleAnswer = () => {
    setShowAnswer(!showAnswer);
  };

  // Combine errors from props and local state
  const displayError = error || localError;

  return (
    <div className="h-full flex flex-col p-4 md:p-6"> {/* Add padding */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6 shadow-lg"> {/* Add shadow */}
        <h2 className="text-xl font-bold mb-4 flex items-center text-gray-100">
          <FiLayers className="mr-2 text-cyan-400" /> {/* Color icon */}
          Tạo thẻ ghi nhớ (Flashcards)
        </h2>
        <p className="text-gray-300 mb-4 text-sm">
          Nhập chủ đề bạn muốn học. Hệ thống sẽ tạo các thẻ ghi nhớ dựa trên tài liệu đã được tải lên.
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <div className="flex flex-col sm:flex-row gap-3"> {/* Adjust gap */}
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="Nhập chủ đề (ví dụ: Machine Learning)"
              className="flex-grow bg-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder-gray-500" // Style input
              disabled={loading} // Use loading prop
            />
            <button
              type="submit"
              disabled={loading || !topicInput.trim() || !token} // Use loading prop and check token
              className={`bg-cyan-600 text-white rounded-md px-5 py-2 flex items-center justify-center transition duration-150 ease-in-out ${loading || !topicInput.trim() || !token ? 'opacity-60 cursor-not-allowed' : 'hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-800'}`} // Use loading prop
            >
              {loading ? ( // Use loading prop
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Đang tạo...
                </>
              ) : (
                'Tạo thẻ'
              )}
            </button>
          </div>
           {!token && <p className="text-xs text-yellow-400 mt-2">Bạn cần đăng nhập để sử dụng tính năng này.</p>}
        </form>

        {/* Display generation error using error prop */}
        {displayError && !loading && (
          <div className="mt-4 text-red-400 bg-red-900/30 p-3 rounded-md flex items-center text-sm border border-red-700"> {/* Style error */}
            <FiAlertTriangle className="mr-2 flex-shrink-0" />
            <span>{displayError}</span>
          </div>
        )}
      </div>

      {/* Flashcard Display Area */}
      <div className="flex-1 flex flex-col min-h-0"> {/* Allow this area to grow and handle overflow */}
        {loading ? ( // Use loading prop for generation loading
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <FiLoader className="animate-spin text-4xl text-cyan-500" />
          </div>
        ) : deckData && currentCards.length > 0 ? ( // Use internal deckData state (updated by useEffect)
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Card Title and Counter */}
            <div className="w-full max-w-2xl mb-3 text-center">
              <h3 className="text-lg font-semibold text-gray-200">
                Bộ thẻ: {deckData.topic || 'Chưa có chủ đề'}
              </h3>
              <p className="text-sm text-gray-400">
                Thẻ {activeCardIndex + 1} / {currentCards.length}
              </p>
            </div>

            {/* Flashcard itself (perspective effect) */}
            <div className="w-full max-w-2xl h-64 md:h-80 [perspective:1000px] mb-4">
              <div
                className={`relative w-full h-full transition-transform duration-700 ease-in-out [transform-style:preserve-3d] ${showAnswer ? '[transform:rotateY(180deg)]' : ''}`}
                onClick={toggleAnswer} // Allow clicking the card to flip
              >
                {/* Front */}
                <div className="absolute w-full h-full bg-gradient-to-br from-gray-700 to-gray-600 rounded-lg shadow-lg flex items-center justify-center p-6 text-center [backface-visibility:hidden]">
                  <p className="text-xl md:text-2xl font-medium text-white">
                    {currentCards[activeCardIndex]?.front || 'Lỗi: Thiếu mặt trước'}
                  </p>
                </div>
                {/* Back */}
                <div className="absolute w-full h-full bg-gradient-to-br from-cyan-800 to-cyan-700 rounded-lg shadow-lg flex items-center justify-center p-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <p className="text-lg md:text-xl text-white whitespace-pre-wrap">
                    {currentCards[activeCardIndex]?.back || 'Lỗi: Thiếu mặt sau'}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-center items-center gap-4 w-full max-w-2xl">
              <button
                onClick={prevCard}
                disabled={activeCardIndex === 0}
                className={`px-4 py-2 rounded-lg text-sm ${activeCardIndex === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-500 text-white transition-colors'}`}
                aria-label="Previous Card"
              >
                Trước
              </button>

              <button
                onClick={toggleAnswer}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                aria-label={showAnswer ? 'Hide Answer' : 'Show Answer'}
              >
                 <FiRotateCw className={`transition-transform duration-300 ${showAnswer ? 'rotate-180' : ''}`} />
                 {showAnswer ? 'Ẩn' : 'Lật'}
              </button>

              <button
                onClick={nextCard}
                disabled={activeCardIndex === currentCards.length - 1}
                className={`px-4 py-2 rounded-lg text-sm ${activeCardIndex === currentCards.length - 1 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-500 text-white transition-colors'}`}
                aria-label="Next Card"
              >
                Tiếp
              </button>
            </div>
          </div>
        ) : !displayError ? ( // Use combined error state to decide whether to show initial message
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FiLayers className="text-5xl mb-4 mx-auto opacity-30" />
              <p>Nhập chủ đề và nhấn "Tạo thẻ" để bắt đầu.</p>
            </div>
          </div>
        ) : null /* Don't show initial message if there's an error */ }
      </div>
    </div>
  );
};

export default FlashcardGenerator;
