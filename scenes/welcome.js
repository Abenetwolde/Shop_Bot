const { Scenes } = require("telegraf")
const Utils = require("../utils")
const Template = require("../template")
const Voucher = require("../modules/voucher")

const welcomeScene = new Scenes.BaseScene("WELCOME_SCENE")

welcomeScene.enter(async (ctx) => {
    Utils.initializeScene(ctx)
    Utils.sendSystemMessage(ctx, Template.welcomeMessage(ctx.botInfo.first_name), Template.welcomeMenuButtons())
    const voucherCode = await Voucher.generateVoucher(ctx)
    Utils.sendSystemMessage(ctx, Template.voucherMessage(voucherCode)) 
})

welcomeScene.on("message", async (ctx) => {
    Utils.updateUserMessageInState(ctx, ctx.message)

    if (ctx.message.text === "📚 View Categories") {
        ctx.scene.enter("CATEGORY_SCENE")
    } else if (ctx.message.text === "🛒 View Cart") {
        ctx.scene.enter("CART_SCENE")
    }
})

welcomeScene.leave(async (ctx) => {
    try {
        console.log("Cleaning welcome scene")
        await Utils.clearScene(ctx, true)
    } catch (error) {
        
    }
})

module.exports = {
    welcomeScene
}