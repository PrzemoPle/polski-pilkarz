(function () {
  "use strict";

  var STORAGE_KEY = "kanban-board-state";

  var COLUMNS = [
    { id: "todo", title: "Do zrobienia" },
    { id: "inprogress", title: "W trakcie" },
    { id: "done", title: "Zrobione" },
  ];

  var boardEl = document.getElementById("kanbanBoard");
  var dialogEl = document.getElementById("cardDialog");
  var formEl = document.getElementById("cardForm");
  var dialogTitleEl = document.getElementById("dialogTitle");
  var columnSelectEl = document.getElementById("cardColumn");
  var titleInputEl = document.getElementById("cardTitle");
  var descriptionInputEl = document.getElementById("cardDescription");
  var deleteBtnEl = document.getElementById("deleteCardBtn");
  var addCardBtnEl = document.getElementById("addCardBtn");
  var saveCardBtnEl = document.getElementById("saveCardBtn");
  var columnTemplate = document.getElementById("columnTemplate");
  var cardTemplate = document.getElementById("cardTemplate");

  var state = loadState();
  var editingCardId = null;
  var dragState = null;

  function createDefaultState() {
    return {
      version: 1,
      columns: {
        todo: [
          {
            id: generateId(),
            title: "Zaplanować sprint",
            description: "Ustalić priorytety na najbliższy tydzień.",
          },
          {
            id: generateId(),
            title: "Przegląd backlogu",
            description: "Uporządkować zadania w kolejce.",
          },
        ],
        inprogress: [
          {
            id: generateId(),
            title: "Projekt UI tablicy",
            description: "Dopracować układ kolumn i animacje przeciągania.",
          },
        ],
        done: [
          {
            id: generateId(),
            title: "Konfiguracja repozytorium",
            description: "Repozytorium gotowe do pracy.",
          },
        ],
      },
    };
  }

  function generateId() {
    return "card-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.columns) return createDefaultState();
      COLUMNS.forEach(function (col) {
        if (!Array.isArray(parsed.columns[col.id])) {
          parsed.columns[col.id] = [];
        }
      });
      return parsed;
    } catch (_err) {
      return createDefaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getCardById(cardId) {
    for (var i = 0; i < COLUMNS.length; i++) {
      var colId = COLUMNS[i].id;
      var cards = state.columns[colId];
      for (var j = 0; j < cards.length; j++) {
        if (cards[j].id === cardId) {
          return { card: cards[j], columnId: colId, index: j };
        }
      }
    }
    return null;
  }

  function populateColumnSelect(selectedId) {
    columnSelectEl.innerHTML = "";
    COLUMNS.forEach(function (col) {
      var option = document.createElement("option");
      option.value = col.id;
      option.textContent = col.title;
      if (col.id === selectedId) option.selected = true;
      columnSelectEl.appendChild(option);
    });
  }

  function render() {
    boardEl.innerHTML = "";

    COLUMNS.forEach(function (col) {
      var columnNode = columnTemplate.content.firstElementChild.cloneNode(true);
      columnNode.dataset.columnId = col.id;
      columnNode.querySelector(".kanban-column__title").textContent = col.title;

      var cardsContainer = columnNode.querySelector(".kanban-column__cards");
      var cards = state.columns[col.id] || [];
      var countEl = columnNode.querySelector(".kanban-column__count");
      countEl.textContent = String(cards.length);
      countEl.setAttribute("aria-label", "Liczba kart: " + cards.length);

      if (cards.length === 0) {
        var empty = document.createElement("p");
        empty.className = "kanban-column__empty";
        empty.textContent = "Brak kart — dodaj nową lub przeciągnij tutaj.";
        cardsContainer.appendChild(empty);
      }

      cards.forEach(function (card, index) {
        cardsContainer.appendChild(createCardElement(card, col.id, index));
      });

      columnNode.querySelector(".kanban-column__add").addEventListener("click", function () {
        openDialog(null, col.id);
      });

      setupColumnDropZone(columnNode, col.id);
      boardEl.appendChild(columnNode);
    });
  }

  function createCardElement(card, columnId, index) {
    var cardNode = cardTemplate.content.firstElementChild.cloneNode(true);
    cardNode.dataset.cardId = card.id;
    cardNode.dataset.columnId = columnId;
    cardNode.dataset.index = String(index);
    cardNode.querySelector(".kanban-card__title").textContent = card.title;
    cardNode.querySelector(".kanban-card__description").textContent = card.description || "";

    cardNode.querySelector(".kanban-card__edit").addEventListener("click", function (e) {
      e.stopPropagation();
      openDialog(card.id);
    });

    cardNode.querySelector(".kanban-card__delete").addEventListener("click", function (e) {
      e.stopPropagation();
      deleteCard(card.id);
    });

    setupCardDrag(cardNode);
    return cardNode;
  }

  function openDialog(cardId, defaultColumnId) {
    editingCardId = cardId || null;

    if (cardId) {
      var found = getCardById(cardId);
      if (!found) return;
      dialogTitleEl.textContent = "Edytuj kartę";
      populateColumnSelect(found.columnId);
      titleInputEl.value = found.card.title;
      descriptionInputEl.value = found.card.description || "";
      deleteBtnEl.classList.remove("hidden");
    } else {
      dialogTitleEl.textContent = "Nowa karta";
      populateColumnSelect(defaultColumnId || "todo");
      titleInputEl.value = "";
      descriptionInputEl.value = "";
      deleteBtnEl.classList.add("hidden");
    }

    dialogEl.showModal();
    titleInputEl.focus();
  }

  function closeDialog() {
    dialogEl.close();
    editingCardId = null;
  }

  function saveCardFromForm() {
    var columnId = columnSelectEl.value;
    var title = titleInputEl.value.trim();
    var description = descriptionInputEl.value.trim();

    if (!title) {
      titleInputEl.focus();
      return;
    }

    if (editingCardId) {
      var found = getCardById(editingCardId);
      if (!found) return;

      if (found.columnId !== columnId) {
        state.columns[found.columnId].splice(found.index, 1);
        state.columns[columnId].push({
          id: found.card.id,
          title: title,
          description: description,
        });
      } else {
        found.card.title = title;
        found.card.description = description;
      }
    } else {
      state.columns[columnId].push({
        id: generateId(),
        title: title,
        description: description,
      });
    }

    saveState();
    closeDialog();
    renderWithCountPulse(columnId);
  }

  function deleteCard(cardId) {
    var found = getCardById(cardId);
    if (!found) return;

    if (dialogEl.open) closeDialog();

    state.columns[found.columnId].splice(found.index, 1);
    saveState();
    renderWithCountPulse(found.columnId);
  }

  function renderWithCountPulse(columnId) {
    render();
    var colEl = boardEl.querySelector('[data-column-id="' + columnId + '"] .kanban-column__count');
    if (colEl) {
      colEl.classList.add("kanban-column__count--pulse");
      colEl.addEventListener("animationend", function handler() {
        colEl.classList.remove("kanban-column__count--pulse");
        colEl.removeEventListener("animationend", handler);
      });
    }
  }

  function moveCard(cardId, targetColumnId, targetIndex) {
    var found = getCardById(cardId);
    if (!found) return;

    var sourceColumnId = found.columnId;
    var sourceIndex = found.index;
    var card = found.card;

    if (sourceColumnId === targetColumnId) {
      if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) return;
      state.columns[sourceColumnId].splice(sourceIndex, 1);
      var adjustedIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
      state.columns[targetColumnId].splice(adjustedIndex, 0, card);
    } else {
      state.columns[sourceColumnId].splice(sourceIndex, 1);
      var insertIndex = Math.min(targetIndex, state.columns[targetColumnId].length);
      state.columns[targetColumnId].splice(insertIndex, 0, card);
    }

    saveState();
    render();
    pulseColumns([sourceColumnId, targetColumnId]);
  }

  function pulseColumns(columnIds) {
    columnIds.forEach(function (colId) {
      var countEl = boardEl.querySelector('[data-column-id="' + colId + '"] .kanban-column__count');
      if (countEl) {
        countEl.classList.add("kanban-column__count--pulse");
        countEl.addEventListener("animationend", function handler() {
          countEl.classList.remove("kanban-column__count--pulse");
          countEl.removeEventListener("animationend", handler);
        });
      }
    });
  }

  /* ---- Drag & drop with pointer events ---- */

  function setupCardDrag(cardEl) {
    cardEl.addEventListener("pointerdown", onPointerDown);
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest(".kanban-card__edit, .kanban-card__delete")) return;

    var cardEl = e.currentTarget;
    var rect = cardEl.getBoundingClientRect();

    dragState = {
      cardId: cardEl.dataset.cardId,
      sourceColumnId: cardEl.dataset.columnId,
      sourceIndex: parseInt(cardEl.dataset.index, 10),
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      cardEl: cardEl,
      ghostEl: null,
      placeholderEl: null,
      currentColumnId: cardEl.dataset.columnId,
      currentIndex: parseInt(cardEl.dataset.index, 10),
    };

    cardEl.classList.add("kanban-card--dragging");

    dragState.ghostEl = cardEl.cloneNode(true);
    dragState.ghostEl.classList.remove("kanban-card--dragging");
    dragState.ghostEl.classList.add("kanban-card--ghost");
    dragState.ghostEl.style.setProperty("--ghost-width", rect.width + "px");
    dragState.ghostEl.style.left = rect.left + "px";
    dragState.ghostEl.style.top = rect.top + "px";
    document.body.appendChild(dragState.ghostEl);

    dragState.placeholderEl = document.createElement("div");
    dragState.placeholderEl.className = "kanban-drop-placeholder kanban-drop-placeholder--visible";

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);

    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragState) return;

    var ghost = dragState.ghostEl;
    ghost.style.left = e.clientX - dragState.offsetX + "px";
    ghost.style.top = e.clientY - dragState.offsetY + "px";

    clearDropHighlights();
    var dropTarget = findDropTarget(e.clientX, e.clientY);

    if (dropTarget) {
      dropTarget.columnEl.classList.add("kanban-column--drag-over");
      dropTarget.cardsContainer.classList.add("kanban-column__cards--drag-over");

      dragState.currentColumnId = dropTarget.columnId;
      dragState.currentIndex = dropTarget.index;

      insertPlaceholder(dropTarget.cardsContainer, dropTarget.index);
    }
  }

  function onPointerUp(_e) {
    if (!dragState) return;

    var cardEl = dragState.cardEl;
    cardEl.classList.remove("kanban-card--dragging");

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);

    if (dragState.ghostEl) dragState.ghostEl.remove();
    if (dragState.placeholderEl) dragState.placeholderEl.remove();
    clearDropHighlights();

    var moved =
      dragState.currentColumnId !== dragState.sourceColumnId ||
      dragState.currentIndex !== dragState.sourceIndex;

    if (moved) {
      moveCard(dragState.cardId, dragState.currentColumnId, dragState.currentIndex);
    }

    dragState = null;
  }

  function findDropTarget(clientX, clientY) {
    var columns = boardEl.querySelectorAll(".kanban-column");

    for (var c = 0; c < columns.length; c++) {
      var columnEl = columns[c];
      var columnId = columnEl.dataset.columnId;
      var cardsContainer = columnEl.querySelector(".kanban-column__cards");
      var containerRect = cardsContainer.getBoundingClientRect();

      if (
        clientX >= containerRect.left - 20 &&
        clientX <= containerRect.right + 20 &&
        clientY >= containerRect.top - 40 &&
        clientY <= containerRect.bottom + 40
      ) {
        var cardEls = cardsContainer.querySelectorAll(".kanban-card:not(.kanban-card--dragging)");
        var index = cardEls.length;

        for (var i = 0; i < cardEls.length; i++) {
          var cardRect = cardEls[i].getBoundingClientRect();
          var midY = cardRect.top + cardRect.height / 2;
          if (clientY < midY) {
            index = i;
            break;
          }
        }

        return { columnEl: columnEl, cardsContainer: cardsContainer, columnId: columnId, index: index };
      }
    }

    return null;
  }

  function insertPlaceholder(container, index) {
    if (!dragState || !dragState.placeholderEl) return;

    var children = Array.prototype.slice.call(container.children);
    var cardChildren = children.filter(function (el) {
      return el.classList.contains("kanban-card") && !el.classList.contains("kanban-card--dragging");
    });

    var placeholder = dragState.placeholderEl;
    placeholder.classList.add("kanban-drop-placeholder--visible");

    if (cardChildren.length === 0) {
      container.appendChild(placeholder);
      return;
    }

    if (index >= cardChildren.length) {
      container.appendChild(placeholder);
    } else {
      container.insertBefore(placeholder, cardChildren[index]);
    }
  }

  function clearDropHighlights() {
    boardEl.querySelectorAll(".kanban-column--drag-over").forEach(function (el) {
      el.classList.remove("kanban-column--drag-over");
    });
    boardEl.querySelectorAll(".kanban-column__cards--drag-over").forEach(function (el) {
      el.classList.remove("kanban-column__cards--drag-over");
    });
    if (dragState && dragState.placeholderEl && dragState.placeholderEl.parentNode) {
      dragState.placeholderEl.parentNode.removeChild(dragState.placeholderEl);
    }
  }

  function setupColumnDropZone(columnEl, columnId) {
    columnEl.addEventListener("dragover", function (e) {
      e.preventDefault();
    });
  }

  /* ---- Event bindings ---- */

  addCardBtnEl.addEventListener("click", function () {
    openDialog(null, "todo");
  });

  saveCardBtnEl.addEventListener("click", saveCardFromForm);

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    saveCardFromForm();
  });

  dialogEl.querySelector('[data-action="cancel"]').addEventListener("click", closeDialog);
  dialogEl.querySelector(".card-dialog__close").addEventListener("click", closeDialog);

  deleteBtnEl.addEventListener("click", function () {
    if (editingCardId && confirm("Czy na pewno chcesz usunąć tę kartę?")) {
      deleteCard(editingCardId);
    }
  });

  dialogEl.addEventListener("click", function (e) {
    if (e.target === dialogEl) closeDialog();
  });

  dialogEl.addEventListener("cancel", function () {
    editingCardId = null;
  });

  render();
})();
