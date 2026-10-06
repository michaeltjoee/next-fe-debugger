// Multiple-choice quiz with instant feedback. Reusable across lessons.
//
// Markup:
//   <div class="quiz">
//     <div class="q" data-correct="2">            <!-- 0-based index of the right choice -->
//       <p class="prompt">Question…</p>
//       <ol class="choices"><li>A</li><li>B</li><li>C</li><li>D</li></ol>
//       <p class="why">Explanation shown after answering.</p>
//     </div>
//   </div>
//   <p class="score" data-score-for="…quiz id…"></p>   (optional; or any .score right after the quiz)
//
// Choices should be the same length in words, so the format gives nothing away.

(() => {
  for (const quiz of document.querySelectorAll(".quiz")) {
    const questions = [...quiz.querySelectorAll(".q")];
    const score = quiz.nextElementSibling?.classList.contains("score") ? quiz.nextElementSibling : null;
    let answered = 0;
    let right = 0;

    const report = () => {
      if (!score) return;
      score.textContent =
        answered < questions.length
          ? `${answered} of ${questions.length} answered`
          : `${right} of ${questions.length} right. ${right === questions.length ? "Solid." : "Re-read the parts you missed, then try again tomorrow."}`;
    };

    for (const q of questions) {
      const correct = Number(q.dataset.correct);
      const items = [...q.querySelectorAll(".choices > li")];
      const buttons = items.map((li) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "choice";
        b.innerHTML = li.innerHTML;
        li.replaceChildren(b);
        return b;
      });
      buttons.forEach((b, i) =>
        b.addEventListener("click", () => {
          if (q.classList.contains("answered")) return;
          q.classList.add("answered");
          const ok = i === correct;
          b.classList.add(ok ? "right" : "wrong");
          buttons[correct]?.classList.add("right");
          buttons.forEach((x) => (x.disabled = true));
          const why = q.querySelector(".why");
          if (why) {
            const verdict = document.createElement("span");
            verdict.className = `verdict ${ok ? "good" : "bad"}`;
            verdict.textContent = ok ? "Right." : "Not quite.";
            why.prepend(verdict, " ");
          }
          answered++;
          if (ok) right++;
          report();
        }),
      );
    }
    report();
  }
})();
