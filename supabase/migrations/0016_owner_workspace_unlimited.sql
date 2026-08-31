-- L'espace de l'éditeur n'est pas un client : il n'a pas à être bridé.
--
-- Les plans servent à encadrer les espaces revendus, pas celui depuis lequel
-- on fabrique le produit. Sur cette instance, l'espace existant était resté sur
-- « Découverte » — 200 entreprises, 1 membre, 2 automatisations — alors qu'il
-- en contenait déjà 299. Les créations d'entreprises étaient donc refusées.
--
-- Sur une instance neuve (celle d'un futur client), aucun espace n'existe
-- encore au moment où cette migration passe : elle n'y change rien, et les
-- espaces créés ensuite démarrent bien sur le plan par défaut.

update workspaces
set plan_id = 'scale'
where plan_id = 'free';

-- Le plan par défaut d'un nouvel espace reste volontairement « Découverte ».
-- Pour ouvrir en grand un espace précis plus tard :
--   update workspaces set plan_id = 'scale' where slug = '<le-slug>';
