const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.grantAccess = functions.https.onRequest(async (request, response) => {
    // Функция теперь специально проверяет метод POST и читает параметры из URL (request.query)
    if (request.method !== "POST") {
        return response.status(405).send("Метод не разрешен. Ожидается POST.");
    }
    
    // 1. Извлекаем данные из URL-параметров (request.query)
    const telegramId = request.query.telegram_id;
    const paidStatus = request.query.paid_status;

    // 2. Логика определения номера недели
    let weekNumber = 0;
    
    // В вашем логе paid_status = 1. Настроим логику:
    if (paidStatus === '1') { // Проверяем, что '1' придет как строка
        weekNumber = 1;
    } else if (paidStatus === 'week2') {
        weekNumber = 2;
    } 
    // ... если нужно, добавьте другие условия оплаты

    if (!telegramId) {
        // Эту ошибку вернула ваша функция!
        console.error("Ошибка 400: Отсутствует параметр telegram_id в URL.");
        return response.status(400).send("Отсутствует параметр telegram_id в URL.");
    }
    if (weekNumber === 0) {
        console.error(`Ошибка 400: Не удалось определить номер недели из paid_status: ${paidStatus}`);
        return response.status(400).send("Не удалось определить номер недели из paid_status.");
    }

    // 3. Запись в Firestore
    try {
        const docRef = db.collection("user_progress").doc(telegramId.toString());

        await docRef.set({
            isSubscriber: true,
            selectedWeek: weekNumber, 
            activationDate: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`Прогресс пользователя ${telegramId} обновлен до Недели ${weekNumber}.`);
        return response.status(200).send({ status: "ok", message: `Доступ предоставлен до недели ${weekNumber}` });

    } catch (error) {
        console.error("Ошибка Firebase при обновлении:", error);
        return response.status(500).send("Ошибка сервера при работе с Firebase.");
    }
});
