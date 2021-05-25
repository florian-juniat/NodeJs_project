const { streetviewpublish } = require("googleapis/build/src/apis/streetviewpublish");



module.exports = {
    generateAvatar: function (name) {

        name = name.split(" ")
        name1 = name[0]
        name2 = ""

        if (name.length > 1) {
            name2 = name[1]
        }

        return "https://eu.ui-avatars.com/api/?name=" + name1 + "+" + name2 + "&background=random&font-size=0.33$bold=true"
    }
}
