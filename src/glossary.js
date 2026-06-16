export const COACH_GLOSSARY = [
    { id: 'possession', term: 'Possession', short: 'Temps où une équipe contrôle la balle.', detail: 'Calculée à partir des changements d\'état de possession dans le replay. Neutre = balle contestée ou en transition.' },
    { id: 'territorial_pressure', term: 'Pression territoriale', short: 'Temps passé dans le tiers offensif adverse avec la balle ou le contrôle.', detail: 'Indicateur de domination territoriale. Utile pour voir si une équipe « camp » l\'adversaire.' },
    { id: 'field_pressure', term: 'Camp adverse', short: 'Temps passé dans la moitié de terrain adverse.', detail: 'Mesure l\'agressivité positionnelle : combien de temps vos joueurs jouent haut sur le terrain.' },
    { id: 'rotation', term: 'Rotations', short: 'Changements de rôle (1er / 2e / 3e homme).', detail: 'Un bon nombre de rotations = fluidité. Trop peu peut indiquer des double commits ou des joueurs figés.' },
    { id: 'rush', term: 'Rush', short: 'Phase où toute l\'équipe pousse offensivement.', detail: 'Tous les joueurs attaquants contre tous les défenseurs — situation à haut risque / haute récompense.' },
    { id: 'last_man', term: 'Last man (dernier défenseur)', short: 'Joueur le plus reculé par rapport à la balle.', detail: 'Buts concédés en étant last man = erreurs de positionnement défensif critiques à revoir en VOD.' },
    { id: 'first_man', term: 'First man (premier attaquant)', short: 'Joueur le plus avancé / proche de la balle.', detail: 'Temps passé en first man élevé = joueur moteur offensif. Trop de temps peut signaler un manque de rotation.' },
    { id: 'behind_ball', term: 'Derrière la balle', short: '% du temps passé entre la balle et son propre but.', detail: 'Position défensive saine. En 3v3, au moins un joueur doit souvent être derrière la balle.' },
    { id: 'boost_avg', term: 'Boost moyen', short: 'Niveau moyen de boost sur le match.', detail: 'Un boost moyen bas (< 30) peut indiquer une mauvaise gestion ou un style très agressif. Pro : viser 40–60 en moyenne selon le rôle.' },
    { id: 'boost_zero', term: 'Temps à 0 boost', short: '% du temps sans boost.', detail: 'Trop élevé = vulnérabilité. Un coach surveille surtout les défenseurs et les moments après une dépense offensive.' },
    { id: 'boost_ledger', term: 'Boost consommé / collecté / volé', short: 'Bilan détaillé des transactions de boost.', detail: 'Consommé = boost dépensé en jeu. Collecté = pads ramassés. Volé = boost pris sur un adversaire (démolition ou contact).' },
    { id: 'touch_control', term: 'Touches (contrôle)', short: 'Contacts doux orientés vers la possession.', detail: 'Distingue le jeu de possession des frappes. Ratio contrôle/frappe révèle le style (mécanique vs power).' },
    { id: 'touch_advance', term: 'Avancée balle', short: 'Distance que la balle avance après un contact.', detail: 'Mesure l\'impact offensif des touches. Forte avancée = jeu orienté but / pression.' },
    { id: 'pass_completed', term: 'Passes complétées', short: 'Passes aboutissant à une touche coéquipier.', detail: 'Indicateur de jeu d\'équipe et de conscience spatiale. À croiser avec les buts et les one-timers.' },
    { id: 'uu', term: 'uu/s (unités Unreal)', short: 'Unité de vitesse dans Rocket League.', detail: 'Supersonic ≈ 2200 uu/s. Vitesse balle au tir : 60 km/h ≈ 1667 uu/s, 100 km/h ≈ 2778 uu/s.' },
    { id: 'aerial_goal', term: 'But aérien', short: 'But marqué après une touche en l\'air.', detail: 'Tag automatique du parser. Utile pour identifier le style aérien et préparer des reviews ciblées.' },
    { id: 'buildup', term: 'Build-up du but', short: 'Contexte de construction du but (contre-attaque, pression, etc.).', detail: 'Kickoff = but dans les premières secondes. Contre-attaque = transition rapide. Pression soutenue = séquence longue en zone adverse.' },
    { id: 'heatmap', term: 'Heatmap', short: 'Carte de chaleur des positions.', detail: 'Zones les plus fréquentées par la balle ou un joueur. Révèle les habitudes de rotation et les zones de jeu préférées.' },
    { id: 'fifty_fifty', term: '50/50', short: 'Duel de balle à deux joueurs.', detail: 'Gagner les 50/50 en défense ou en attaque change le momentum. Compteur utile pour les reviews kickoff et contests.' },
    { id: 'speed_flip', term: 'Speed flip', short: 'Flip diagonal pour gagner du temps au kickoff ou en rotation.', detail: 'Mécanique fondamentale en compétitif. Fréquence élevée = joueur optimisé mécaniquement.' }
];

export function glossaryHtml(filter = '') {
    const q = filter.toLowerCase();
    const items = COACH_GLOSSARY.filter(g =>
        !q || g.term.toLowerCase().includes(q) || g.short.toLowerCase().includes(q)
    );
    return items.map(g => `
        <article class="glossary-item" id="gloss-${g.id}">
            <h4>${g.term}</h4>
            <p class="glossary-short">${g.short}</p>
            <p class="glossary-detail">${g.detail}</p>
        </article>
    `).join('');
}

export function termTip(id) {
    const g = COACH_GLOSSARY.find(x => x.id === id);
    if (!g) return '';
    return `<button type="button" class="term-tip" data-gloss="${id}" title="${g.short}">?</button>`;
}
