import React from 'react';
import type { HeadFC } from "gatsby"
import DefaultBlogWrapper from '../../components/DefaultBlogWrapper';
import SEOHead from '../../components/SEOHead'

const EggHoneyCustard: React.FunctionComponent = () => (
    <DefaultBlogWrapper>
        <h1>Egg-Honey Custard</h1>
        <h2>Ingredients</h2>
        <ul>
            <li>600 ml cream</li>
            <li>300 ml milk</li>
            <li>8 eggs</li>
            <li>2/3 cup honey</li>
            <li>9 g salt</li>
        </ul>
        <h2>Method</h2>
        <ol>
            <li>Preheat the oven to 160°C (320°F).</li>
            <li>In a saucepan, combine the milk and cream. Heat over low-medium heat until steaming, but do not let it boil (see note below).</li>
            <li>In a large bowl, whisk the eggs and salt together until well combined.</li>
            <li>While continuously whisking the egg mixture, slowly pour in the warm milk and cream mixture to temper the eggs.</li>
            <li>Add the honey to the mixture, whisking until fully incorporated.</li>
            <li>Pour the custard mixture into a baking dish.</li>
            <li>Place the baking dish into a larger roasting pan or tray. Carefully fill the roasting pan with boiling water to create a water bath, ensuring the water reaches about halfway up the sides of the custard dish.</li>
            <li>Place the entire setup into the preheated oven and bake for 50 minutes, or until the custard is set but still slightly jiggly in the center.</li>
            <li>Remove from the oven and water bath, then let it cool before serving.</li>
        </ol>
        <h2>Notes</h2>
        <ul>
            <li>This recipe is quite forgiving and easy to alter. You can adjust the sweetness by varying the amount of honey, swap out some cream for milk for a lighter texture, or even add flavors like vanilla, cinnamon, or nutmeg to suit your taste.</li>
            <li>If the milk and cream mixture accidentally boils, the custard will still work, but the texture may not be as smooth and creamy because the cream can begin to separate.</li>
            <li>The goal of this recipe is to create a relatively high-fat dish that's nutritious and filling. The generous use of eggs—nature's multivitamin—along with cream provides a rich source of protein and healthy fats to keep you satisfied.</li>
        </ul>
    </DefaultBlogWrapper>
)

export default EggHoneyCustard;

export const Head: HeadFC = () => (
    <SEOHead
        title="Egg-Honey Custard"
        description="Easy Egg-Honey Custard recipe: creamy, rich with eggs and cream, honey-sweetened, baked in a water bath. High-fat, nutritious, and filling."
    />
)

