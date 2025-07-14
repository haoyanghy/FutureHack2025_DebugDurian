document.getElementById("checkButton").addEventListener("click", function() {
  const reviewText = document.getElementById("reviewInput").value;
  const resultDiv = document.getElementById("result");

  if (!reviewText.trim()) {
    resultDiv.textContent = "Please enter a review!";
    return;
  }

  // Simulate fake review detection (no API call)
  const isFake = detectFakeReview(reviewText);
  
  if (isFake) {
    resultDiv.textContent = "⚠️ This review appears FAKE!";
    resultDiv.className = "fake";
  } else {
    resultDiv.textContent = "✅ This review seems GENUINE!";
    resultDiv.className = "genuine";
  }
});

// Mock detection function (replace with real logic)
function detectFakeReview(text) {
  const suspiciousWords = ["amazing", "best", "perfect", "awesome", "love it"];
  const wordCount = text.split(" ").length;
  
  // Check for excessive positivity + short length
  const positiveWords = suspiciousWords.filter(word => 
    text.toLowerCase().includes(word)
  ).length;
  
  return (positiveWords >= 3 && wordCount < 20);
}
