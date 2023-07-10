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
    await validateUserAccount(ctx.from.id, ctx.from.first_name, ctx.botInfo.id, ctx.chat.id)          // Validate user accounts upon entering a shop
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
        ctx.session.cleanUpState = [{ id: ctx.message.message_id, type: "user" }]
    }
})

bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true)
})

bot.launch({ dropPendingUpdates: true })

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