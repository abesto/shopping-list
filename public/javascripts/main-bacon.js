/*global $, Backbone, Hogan, Bacon*/
(function () {
    'use strict';
    var Models = {}, Views = {}, Collections = {};


    Models.Tab = Backbone.Model.extend({
        initialize: function () {
            this.items = new Collections.Items();
            this.items.tab = this;
            this.pillView = new Views.TabPill({model: this});
            this.contentView = new Views.TabContent({model: this});
        }
    });

    Models.Item = Backbone.Model.extend({
        defaults: { done: false },

        initialize: function () {
            this.view = new Views.Item({model: this});
        }
    });

    Collections.Tabs = Backbone.Collection.extend({
        url: '/tab',
        model: Models.Tab,
        initialize: function () {
            this.pillView = new Views.TabsPill({collection: this});
            this.contentView = new Views.TabsContent({collection: this});
        }
    });

    Views.Item = Backbone.View.extend({
        tagName: 'tr',
        className: 'item',

        events: {
            'click': 'toggleDone',
            'click .delete': 'destroy'
        },

        initialize: function () {
            this.$el.data('view', this);
            this.$td = $('<td>').appendTo(this.$el);
            this.$text = $('<span>').addClass('text').appendTo(this.$td);
            $('<a>')
                .appendTo(this.$td)
                .addClass('delete').addClass('btn')
                .addClass('hidden-phone')
                .text('Töröl');

            this.model.on('change', this.render, this);
        },

        render: function () {
            this.$text.text(this.model.get('text'));
            this.$el.toggleClass('done', this.model.get('done'));
            return this;
        },

        toggleDone: function () {
            this.model.set('done', !this.model.get('done'));
            this.model.save();
        },

        destroy: function (e) {
            e.stopPropagation();
            this.model.destroy();
        }
    });


    Views.Items = Backbone.View.extend({
        tagName: 'table',
        className: 'table',

        events: {
            'submit form': 'create'
        },

        initialize: function () {
            this.collection.on('add', this.add, this);
            this.collection.on('remove', this.remove, this);
            this.collection.on('reset', this.render, this);
            this.$tbody = $('<tbody>').sortable({stop: this.refreshPositions});
            this.$el.append(this.$tbody).append('<tfoot>');
            this.$tfoot = this.$('tfoot').append(
                '<tr><td colspan="2"><form class="form-inline"><input type="text" name="text"/><input type="submit" value="Felvesz" class="btn"/></form></td></tr>'
            ).addClass('hidden-phone');
        },

        render: function () {
            var i;
            this.$tbody.children().remove();
            for (i = 0; i < this.collection.length; i += 1) {
                this.$tbody.append(this.collection.at(i).view.render().el);
            }
            return this;
        },

        add: function (model, collection, options) {
            this.$tbody.append(model.view.render().$el);
        },

        remove: function (model, collection, options) {
            this.$tbody.find(model.view.$el).remove();
        },

        create: function (e) {
            e.preventDefault();
            var i, position = 0, text = this.$('input[name=text]').val().trim();
            if (this.collection.length > 0) {
                position = this.collection.at(0).get('position');
                for (i = 1; i < this.collection.length; i += 1) {
                    position = Math.max(position, this.collection.at(i).get('position'));
                }
                position += 1;
            }
            if (text.length === 0) { return; }
            this.$('input[name=text]').val('');
            this.collection.create({
                tabId: this.collection.tab.get('id'),
                text: text,
                position: position
            });
        },

        refreshPositions: function (e, ui) {
            var i, notLast, positionCollision,
                view = ui.item.data('view'),
                model = view.model,
                collection = model.collection;

            ui.item.parent().children().each(function (position, item) {
                var model = $(item).data('view').model;
                if (model.get('position') === position) {
                    return;
                }
                model.set('position', position);
                model.save();
            });
        }
    });

    Collections.Items = Backbone.Collection.extend({
        url: '/item',
        model: Models.Item,
        comparator: function (item) { return item.get('position'); },

        initialize: function () {
            this.view = new Views.Items({collection: this});
        }
    });

    Views.TabPill = Backbone.View.extend({
        tagName: 'li',
        className: 'tab',

        events: {
            'shown a': 'shown',
            'click .icon-remove': 'delete',
            'click .icon-edit': 'edit'
        },

        href: function () { return '#tab-' + this.model.get('id'); },
        text: function () { return this.model.get('text'); },

        initialize: function () {
            this.model.on('change', this.render, this);
            this.$a = $('<a>').attr('href', this.href());
            this.$text = $('<span>').appendTo(this.$a);
            this.$edit = $('<i>').addClass('icon-edit').addClass('hidden-phone').appendTo(this.$a);
            this.$del = $('<i>').addClass('icon-remove').addClass('hidden-phone').appendTo(this.$a);
            this.$el.append(this.$a);
        },

        render: function () {
            this.$text.text(this.text());
            this.$a.attr('data-toggle', 'pill');
            return this;
        },

        show: function () {
            this.$a.tab('show');
        },

        shown: function () {
            this.model.items.fetch({data: {'tab': this.model.get('id')}});
        },

        delete: function (e) {
            e.stopPropagation();
            if (confirm('Biztosan törölni akarod a "' + this.text() + '" nevű fület?')) {
                if (this.$el.hasClass('active') && this.model.collection.length > 1) {
                    var newActive = this.model.collection.at(0);
                    if (newActive === this.model) {
                        newActive = this.model.collection.at(1);
                    }
                    newActive.pillView.show();
                }
                this.model.destroy();
            }
        },

        edit: function (e) {
            e.stopPropagation();
            this.model.set('text', prompt('A "' + this.text() + '" fül új neve:'));
            this.model.save();
        }
    });

    Views.NewTabPill = Backbone.View.extend({
        tagName: 'li',
        className: 'hidden-phone',
        href: function () { return '#new-tab-modal'; },
        text: function () { return '+'; },
        initialize: function () {
            this.$a = $('<a>')
                .attr('href', this.href())
                .attr('data-toggle', 'modal')
                .text('+')
                .appendTo(this.$el);

            var $newTabModal =  $('#new-tab-modal'),
                $newTabForm = $newTabModal.find('form'),
                $newTabName = $newTabForm.find('input[name=new-tab-name]'),
                that = this;
            $newTabModal.on('shown', function () {
                $newTabName.focus();
            });
            $newTabModal.on('hidden', function () {
                that.$a.blur();
            });
            $newTabForm.submit(function (e) {
                e.preventDefault();
                that.collection.create({text: $newTabName.val()});
                $newTabName.val('');
                $newTabModal.modal('hide');
            });
        }
    });

    Views.TabContent = Backbone.View.extend({
        tabName: 'div',
        className: 'tab-pane',

        id: function () { return 'tab-' + this.model.get('id'); },

        initialize: function () {
            var that = this;
            this.model.on('change:id', function () {
                that.$el.attr('id', that.id());
            });
        },

        render: function () {
            this.$el.children().remove();
            this.$el.append(
                this.model.items.view.render().$el
            );
            return this;
        }
    });

    Views.TabsPill = Backbone.View.extend({
        tagName: 'ul',
        className: 'nav nav-tabs',

        initialize: function () {
            this.newTabView = new Views.NewTabPill({collection: this.collection}).render();

            this.collection.on('add', this.render, this);
            this.collection.on('remove', this.remove, this);
            this.collection.on('reset', this.render, this);
        },

        remove: function (model, collection, options) {
            this.$el.find(model.pillView.$el).remove();
        },

        render: function () {
            var i;
            this.$el.children().remove();
            for (i = 0; i < this.collection.length; i += 1) {
                this.$el.append(this.collection.at(i).pillView.render().$el);
            }
            this.$el.append(this.newTabView.render().$el);
            return this;
        }
    });

    Views.TabsContent = Backbone.View.extend({
        tagName: 'div',
        className: 'tab-content',

        initialize: function () {
            this.collection.on('add', this.render, this);
            this.collection.on('remove', this.remove, this);
            this.collection.on('reset', this.render, this);
            this.render();
        },

        render: function () {
            var i;
            this.$el.children().remove();
            for (i = 0; i < this.collection.length; i += 1) {
                this.$el.append(this.collection.at(i).contentView.render().$el);
            }
            if (this.collection.length > 0) {
                this.collection.at(0).pillView.show();
            }
            return this;
        },

        remove: function (model, collection, options) {
            this.$el.find(model.contentView.$el).remove();
        }
    });

    $(function () {
        var tabs = new Collections.Tabs();
        $('#content')
            .append(tabs.pillView.$el)
            .append(tabs.contentView.$el);
        tabs.fetch();
        // Leak into global namespace for debugging
        window.tabs = tabs;
    });


}());

