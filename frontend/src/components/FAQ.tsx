import React, { useState } from "react";
import "./FAQ.css";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "Как пополнить баланс?",
    answer: "Подключите кошелек TON через кнопку 'Подключить кошелек', затем введите сумму в разделе 'Депозит' и нажмите 'Пополнить'. Подтвердите транзакцию в кошельке."
  },
  {
    question: "Как вывести средства?",
    answer: "В разделе 'Вывод' введите адрес получателя и сумму. Нажмите 'Запросить вывод' и подтвердите транзакцию. Вывод обрабатывается автоматически."
  },
  {
    question: "Как работают игры?",
    answer: "Все игры используют provably fair механику - результаты генерируются на основе seed и hash, что гарантирует честность. Вы можете проверить результат после каждой игры."
  },
  {
    question: "Что такое Mines?",
    answer: "Mines - это игра, где вы открываете ячейки на поле. Цель - открыть все ячейки без мин. Чем больше ячеек вы откроете, тем выше множитель выигрыша."
  },
  {
    question: "Что такое Dice?",
    answer: "Dice - это игра на угадывание числа от 1 до 100. Вы выбираете, выпадет число больше или меньше вашего выбора. Чем ближе к границе, тем выше множитель."
  },
  {
    question: "Что такое Plinko?",
    answer: "Plinko - это игра, где шарик падает через препятствия и попадает в один из слотов с разными множителями. Выбирайте уровень риска: безопасный, средний или рискованный."
  },
  {
    question: "Что такое PvP?",
    answer: "PvP - это игра против других игроков. Все участники делают ставки, и победитель определяется случайным образом пропорционально размеру ставок. Победитель забирает весь банк."
  },
  {
    question: "Безопасно ли это?",
    answer: "Да, все транзакции проходят через официальный TON Connect, ваши приватные ключи не передаются. Мы используем provably fair механику для честности игр."
  },
  {
    question: "Есть ли минимальная сумма ставки?",
    answer: "Минимальная сумма ставки зависит от игры. Обычно это 0.01 TON. Точную информацию смотрите в интерфейсе каждой игры."
  },
  {
    question: "Как проверить честность игры?",
    answer: "После каждой игры вы получаете seed и hash, которые можно проверить. Результат генерируется детерминированно на основе этих данных, что исключает манипуляции."
  }
];

export const FAQ: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-container">
      <div className="faq-header">
        <button onClick={onBack} className="faq-back-button">
          ← Назад
        </button>
        <h2>Часто задаваемые вопросы</h2>
      </div>

      <div className="faq-list">
        {faqData.map((item, index) => (
          <div key={index} className="faq-item">
            <button
              className="faq-question"
              onClick={() => toggleItem(index)}
            >
              <span>{item.question}</span>
              <span className="faq-icon">
                {openIndex === index ? "−" : "+"}
              </span>
            </button>
            {openIndex === index && (
              <div className="faq-answer">
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};


