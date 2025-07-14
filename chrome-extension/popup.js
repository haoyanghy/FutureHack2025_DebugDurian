async function submitReview() {
    const reviewText = document.getElementById("review").value;
    const response = await fetch("http://localhost:8000/durian/review", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: reviewText })
    });

    const result = document.getElementById("result");

    if (response.ok) {
        const data = await response.json();
        result.textContent = `Label: ${data.label}\nConfidence: ${data.confidence}\n\nExplanation:\n${data.explanation}`;
    } else {
        const error = await response.json();
        result.textContent = `Error: ${error.detail}`;
    }
}
