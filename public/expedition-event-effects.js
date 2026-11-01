export function createEventEffects(root) {
    const cards = document.createElement('div');
    cards.className = 'gift-events';
    const rocks = document.createElement('div');
    rocks.className = 'rock-effects';
    root.append(cards);
    root.querySelector('.shaft').append(rocks);
    return (state, now) => {
        for (const container of [cards, rocks]) {
            for (const node of [...container.children])
                if (!state.rocks.some(rock => rock.id === node.dataset.id)) node.remove();
        }
        for (const rock of state.rocks) {
            let card = [...cards.children].find(node => node.dataset.id === rock.id);
            let sprite = [...rocks.children].find(node => node.dataset.id === rock.id);
            if (!card) {
                card = document.createElement('div');
                card.dataset.id = rock.id;
                card.innerHTML = '<small></small><strong></strong><p></p><span></span>';
                cards.append(card);
                sprite = document.createElement('div');
                sprite.dataset.id = rock.id;
                sprite.className = 'gift-rock';
                sprite.innerHTML = '<i class="rock-shadow"></i><i class="rock-sprite"></i><i class="rock-fragments">· ◆ ·</i>';
                sprite.style.left = `${21 + rock.lane * 29}%`;
                sprite.style.bottom = `${8 + (rock.floor - 1) * (82 / 6)}%`;
                rocks.append(sprite);
            }
            card.className = `gift-event ${rock.total >= 10 ? 'gift-burst' : ''}`;
            card.dataset.status = rock.status;
            sprite.dataset.status = rock.status;
            sprite.classList.toggle('gift-burst', rock.total >= 10);
            card.querySelector('small').textContent = `${state.mode === 'demo' ? 'SIMULATED · ' : ''}GIFT SUB${rock.total === 1 ? '' : 'S'} · CAMP ${rock.team.toUpperCase()}`;
            card.querySelector('strong').textContent = rock.status === 'warning' ? `ROCK IN ${Math.max(0, Math.ceil((rock.impactAt - now) / 1000))}s` : rock.status === 'lost' ? 'BACK TO CAMP' : rock.status.toUpperCase();
            card.querySelector('p').textContent = rock.message;
            card.querySelector('span').textContent = rock.status === 'warning' ? '35% chance · 1 HP · shields block' : rock.total >= 10 ? 'Big gift. Still just one rock.' : 'Banked loot stays safe.';
        }
    };
}
