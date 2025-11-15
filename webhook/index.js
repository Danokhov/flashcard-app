const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Инициализация Admin SDK (дает функции права администратора для работы с БД)
admin.initializeApp();
const db = admin.firestore();

/**
 * Вебхук для приема данных об оплате от SendPulse.
 * Обновляет статус подписки и оплаченную неделю в Firestore.
 * Ожидает POST-запрос с полями telegram_id и week_number.
 */
exports.grantAccessWebhook = functions.https.onRequest(async (request, response) => {
    // 1. Проверка метода (должен быть POST)
    if (request.method !== 'POST') {
        return response.status(405).send('Метод не разрешен. Ожидается POST.');
    }
    
    // 2. Извлечение данных из тела запроса (от SendPulse)
    const { telegram_id, week_number } = request.body; 

    // 3. Валидация данных
    if (!telegram_id || !week_number) {
        console.error('Ошибка: Отсутствует telegram_id или week_number.', request.body);
        return response.status(400).send('Отсутствует telegram_id или week_number.');
    }

    const userId = telegram_id.toString(); 
    const week = parseInt(week_number, 10);
    
    if (isNaN(week) || week < 1) {
        console.error('Ошибка: week_number не является корректным числом.');
        return response.status(400).send('week_number должен быть числом больше 0.');
    }

    try {
        // 4. Обновление Firestore: user_progress/{telegram_id}
        const docRef = db.collection('user_progress').doc(userId);

        await docRef.set({
            isSubscriber: true,
            selectedWeek: week, // Например, 2
            activationDate: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }); // { merge: true } предотвращает удаление других полей

        // 5. Успешный ответ (код 200) для SendPulse
        console.log(`Прогресс пользователя ${userId} обновлен до Недели ${week}.`);
        return response.status(200).send({ status: 'ok', message: `Доступ предоставлен до недели ${week}` });

    } catch (error) {
        // 6. Обработка ошибок
        console.error("Ошибка Firebase при обновлении:", error);
        return response.status(500).send('Ошибка сервера при работе с Firebase.');
    }
});
