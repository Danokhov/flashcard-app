const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.grantAccess = functions.https.onRequest(async (request, response) => {
    // 1. Проверяем данные в URL (request.query)
    const telegramId = request.query.telegram_id;
    const paidStatus = request.query.paid_status; // Будем использовать этот ключ

    // 2. Определяем номер недели на основе статуса оплаты
    let weekNumber = 0;
    
    // ПРИМЕЧАНИЕ: Здесь вы должны настроить логику, которая определяет номер недели.
    // Если "paid_status" = 'week1', то weekNumber = 1.
    if (paidStatus === 'week1') {
        weekNumber = 1;
    } else if (paidStatus === 'week2') {
        weekNumber = 2;
    } 
    // ... можно добавить другие условия

    if (!telegramId) {
        return response.status(400).send("Отсутствует параметр telegram_id в URL.");
    }
    if (weekNumber === 0) {
        return response.status(400).send("Не удалось определить номер недели из параметра paid_status.");
    }

    try {
        const docRef = db.collection("user_progress").doc(telegramId.toString());

        await docRef.set({
            isSubscriber: true,
            selectedWeek: weekNumber, 
            activationDate: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`Прогресс пользователя ${telegramId} обновлен до Недели ${weekNumber}.`);
        const message = `Доступ предоставлен до недели ${weekNumber}`;
        return response.status(200).send({ status: "ok", message: message });

    } catch (error) {
        console.error("Ошибка Firebase при обновлении:", error);
        return response.status(500).send("Ошибка сервера при работе с Firebase.");
    }
});
