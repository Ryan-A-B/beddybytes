import React from 'react';
import type { HeadFC } from "gatsby"
import DefaultBlogWrapper from '../../components/DefaultBlogWrapper';
import SEOHead from '../../components/SEOHead'

const BabyRoutineAndRitual: React.FunctionComponent = () => (
    <DefaultBlogWrapper>
        <h1>Baby Routine and Ritual</h1>
        <p>
            Leading up to the birth of our now 2-year-old, my wife and I were
            reading and watching everything we could find about looking after
            a newborn. While in an information session run by our hospital,
            another soon-to-be-parent asked a question. They said they were
            extremely routine-driven, and asked if there was any way they could
            keep their routine. After a hearty chuckle from the nurse, they
            were told no, their routine would be going out the window. I now
            think this was a terrible response. Not because it was wrong, but
            because of what was missing. Part of your job as a parent is to
            work with your child to find the new routine.
        </p>
        <p>
            I remember thinking at around the 4-month mark that we had a
            miracle baby. She'd go down to sleep at night easily and we'd get
            an uninterrupted night about once a week. When she did wake at
            night, it was usually only once or twice. Less than a month later,
            I was ready to perform a sacrifice to any deity that would listen.
            We were getting sleep in 1- to 2-hour stretches, then needing to
            spend 30 minutes settling her again (exercise balls are a life
            changer). This continued for about 6 months. We tried a bunch of
            things. We tracked sleep fanatically trying to figure out when we
            should put her down for her next nap. We tried watching for the
            mystical tired signs to let us know when to put her down.
        </p>
        <p>
            At around the 10-month mark, something had to give. My wife and I
            were exhausted. Our baby was unhappy. Things that once served us,
            no longer did. Even my wife nursing her to sleep wasn't working
            anymore. One night, I put our daughter down in her cot, lay down
            next to her on the floor and was as boring as possible. When she
            started complaining I'd still do nothing (sometimes singing
            lullabies, but not directly interacting). Mostly she was trying to
            get my attention and get me to interact with her. One thing I
            didn't do was fill my wife in on my plan, definitely something I
            should have done. She was reasonably annoyed at the change of
            strategy without discussion. Fortunately, the new tactic worked and
            we all had a blissful, desperately needed night of sleep.
        </p>
        <p>
            We continued this strategy for a few weeks. Things improved. We
            were getting better sleep, but still dreaded nap time. Steeling
            ourselves for 10 to 20 minutes of complaining and crying while
            laying on the floor next to our daughter. It was heartbreaking not
            to hold her and bounce her to sleep, but our theory was that at
            least by laying next to her, she'd be comforted and know we hadn't
            abandoned her. After some research (and better sleep) we realised
            that us laying in the room next to her was holding her back.
            Everytime we scratched our nose or moved, we were unwittingly
            stimulating her and distracting her from learning the skill she had
            to practise herself: getting to sleep.
        </p>
        <p>
            Sleep training is such a polarising subject between parenting
            styles. I can only speak from our own experience, and I know that
            both my wife and I need more than stolen snatches of sleep to be
            good spouses and parents. So, we started sleeping training in
            earnest. Say good night, put her down and leave the room. Keeping
            an ear out for crying, but only going in after 5 minutes. The very
            first night we tried she got herself to sleep without us needing to
            go in once. If you're looking for tips here, try The Happy Sleeper
            by Heather Turgeon and Julie Wright. It's a great resource.
        </p>
        <p>
            From here, we built both a routine and a ritual. Our night time
            routine has now been consistent for about a year. Dinner, bath then
            in bed by 7:30. Of a day we've changed the routine depending on her
            sleep requirements as she's grown. We've gone from a 40 minute nap
            around 10am and a 90 minute nap around 12:30 when she was 11
            months. To a 10 minute nap around 10am and a 2 hour nap around
            12:30 when she was 14 months. To what we have now, a 2 to 2.5 hour
            nap at 12:30 when she was 18 months. Another parent friend of ours
            calls this her “lunch break”.
        </p>
        <p>
            We've kept the bedtime ritual consistent for over a year now too.
            We have dinner together, then either my wife or I will give our
            daughter a well-needed bath and brush her teeth. While we dress her
            in pyjamas, we sing the same three songs (Twinkle Twinkle, ABC, and
            one of our own creation) in the same order. Then, we cuddle while
            reading a book, have a last drink of water (one for her toys too,
            of course). Then we ask her to put her “sleeping friends”, Winnie
            and Lovey and herself into bed. Followed by a final kiss on the
            cheek and leaving the room.
        </p>
        <p>
            For our next child, I'll be looking to put in place a routine much
            earlier. It isn't recommended to begin sleep training before the
            4 - 6 month mark as babies aren't ready to learn to self-soothe
            before then. But, I'll be trying to work with them to find a
            routine, which admittedly will change frequently during the first
            6 - 12 months. We'll also need to work to ensure our eldest
            daughter still has the stable routine that's been working so well
            for our family in the last few months.
        </p>
        <p>
            Routine and ritual give your child a solid foundation from which
            they can grow from.
        </p>
    </DefaultBlogWrapper>
)

export default BabyRoutineAndRitual;

export const head: HeadFC = () => (
    <SEOHead
        title="Baby Routine and Ritual"
        description="Discover the importance of establishing routines and rituals for better sleep and happier parenting. Learn from our personal experience."
    />
)