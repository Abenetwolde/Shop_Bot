const { Telegraf, session, Scenes, Markup } = require("telegraf")
const CustomScenes = require("./scenes")
const Dummy = require("./modules/dummy")
const Database = require("./database/actions")
const Utils = require("./utils")
const Template = require("./template")
const express = require("express")


const bot = new Telegraf(process.env.BOT_TOKEN)

// Middlewares
const stage = new Scenes.Stage([
    CustomScenes.welcomeScene,
    CustomScenes.categoryScene,
    CustomScenes.productScene,
    CustomScenes.cartScene,
    CustomScenes.paymentScene,
    CustomScenes.dateScene,
    CustomScenes.noteScene,
], {
    default: CustomScenes.welcomeScene,
})

bot.use(session())
bot.use(stage.middleware())

bot.command("start", async (ctx) => {
    const shop = await Database.getShopByID(ctx.botInfo.id)
    if (!shop) {
        if (process.env.MODE === "demo")
            await Dummy.createDummyData(ctx)
        else
            return await Utils.sendSystemMessage(ctx, "The shop has not yet been setup!")
    }
    await validateUserAccount(ctx.from.id, ctx.from.first_name, ctx.botInfo.id, ctx.chat.id)
    //if there is no user create user        // Validate user accounts upon entering a shop
    await validateChatRecord(ctx.botInfo.id, ctx.from.id, ctx.chat.id)
    ctx.deleteMessage()
    Utils.clearScene(ctx, true)
    ctx.scene.enter("WELCOME_SCENE")
})

bot.command("setup", async (ctx) => {
    try {
        const shop = await Database.getShopByID(ctx.botInfo.id)
        if (!shop) {
            const token = ctx.message.text.split(" ")[1]
            if (!token) {
                throw "Are you <b>missing</b> a token? Kindly use the command again with the token <i>(i.e. /setup SECRET_BOT_TOKEN)</i>"
            } else if (token !== process.env.BOT_TOKEN) {
                console.log(token, process.env.BOT_TOKEN)
                throw "This is an <b>invalid</b> bot token. Retrieve the token from @BotFather and use the command again <i>(i.e. /setup SECRET_BOT_TOKEN)</i>"
            }

            // Validation of user account
            var user = await validateUserAccount(ctx.from.id, ctx.from.username)
            user.update({
                isOwner: true
            })

            // Creation of shop
            await Database.createShop(ctx.botInfo.id, ctx.botInfo.first_name, ctx.from.id, token)

            // Validation of chat
            validateChatRecord(ctx.botInfo.id, ctx.from.id, ctx.chat.id)
            await Utils.sendSystemMessage(ctx, Template.registrationSuccessMessage(ctx.from.id, ctx.from.username, ctx.botInfo.first_name))
        } else {
            await Utils.sendSystemMessage(ctx, "This shop has already been setup!")
        }
    } catch (error) {
        await Utils.sendSystemMessage(ctx, error)
    }
})

bot.on("message", async (ctx) => {
    if (ctx.session.cleanUpState && ctx.session.cleanUpState.length > 0) {
        Utils.updateUserMessageInState(ctx, ctx.message)
    } else {
        // If it’s not, it will set the cleanUpState property to an array containing an object with the ID of the received message and a type of “user”.
        ctx.session.cleanUpState = [{ id: ctx.message.message_id, type: "user" }]
    }
})

bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true)
    /*     respond to a pre-checkout query sent by a user when they are about to make a payment. 
          By passing in true, 
        this code is indicating that the payment should be allowed to proceed. */
})
/* dropPendingUpdates option, when set to true, tells the bot to ignore
 any updates that were received before the bot was started. */
bot.launch({ dropPendingUpdates: true })
/* process object, which is a global object in Node.js that provides 
information about and control over the current Node.js process. */
process.once("SIGINT", () => bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.stop("SIGTERM"))

const validateUserAccount = async (userID, userName) => {
    var user = await Database.getUserByID(userID)
    if (!user) {
        user = await Database.createUser(userID, userName)
    }
    return user
}

const validateChatRecord = async function (shopID, userID, chatID) {
    const chat = await Database.getChat(shopID, userID)
    if (!chat) {
        await Database.createChat(shopID, userID, chatID)
    }
}

const app = express()
app.get("/", (req, res) => res.status(200).send({ message: "ok" }))
app.listen(process.env.PORT || 3000)


/* 
The first event listener listens for the “SIGINT” event, which is typically triggered when the user presses CTRL-C on their keyboard. When this event is received, the callback function is called,
 which calls the stop method on the bot object, passing in “SIGINT” as an argument. This method is used to gracefully stop the bot.

The second event listener listens for the “SIGTERM” event, 
which is typically triggered when the operating system sends
 a signal to the process to terminate it. When this event is received, the callback function is called, which calls the stop method on the bot object, passing in “SIGTERM” as an argument. This method is used to gracefully stop the bot.

Both event listeners are set up using the once method on 
the process object, which means that they will only be triggered once.
 After being triggered, they will be automatically removed and will not be 
 triggered again.
*/